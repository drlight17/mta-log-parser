"""

Copyright::
    +===================================================+
    |                 © 2019 Privex Inc.                |
    |               https://www.privex.io               |
    +===================================================+
    |                                                   |
    |        Postfix Log Parser / Web UI                |
    |                                                   |
    |        Core Developer(s):                         |
    |                                                   |
    |          (+)  Chris (@someguy123) [Privex]        |
    |                                                   |
    +===================================================+

"""
import asyncio
import logging
import re
import rethinkdb.query
from enum import Enum
from typing import Dict
from mlp import settings
from mlp.core import get_rethink
from mlp.objects import PostfixLog, PostfixMessage
from mlp.parser import parse_line
import email
import base64
import quopri
from datetime import datetime, timedelta, timezone
from quart import jsonify

log = logging.getLogger(__name__)

# !!! change version upon update !!!
global VERSION
VERSION ="1.3"

# postfix regexp
postf_match = r'([A-Za-z]+[ \t]+[0-9]+[ \t]+[0-9]+\:[0-9]+:[0-9]+).*'
"""(0) Regex to match the Date/Time at the start of each log line"""
# postf_match += r'([A-F0-9]{11})\:[ \t]+?(.*)'
postf_match += r'\:[ \t]([A-F0-9]{1,15})\:[ \t]+?(.*)'
"""Regex to match the (1) Queue ID and the (2) Log Message"""

# exim regexp (for syslog and separate mainlog)
exim_match = r'([A-Za-z]+[ \t]+[0-9]+[ \t]+[0-9]+\:[0-9]+:[0-9]+|\d{4}-\d{2}-\d{2}.\d{2}\:\d{2}\:\d{2}).*'
"""(0) Regex to match the Date/Time at the start of each log line"""
#exim_match += r'([A-Za-z]+[ \t]+[0-9]+[ \t]+[0-9]+\:[0-9]+:[0-9]+|\d{4}-\d{2}-\d{2}.\d{2}\:\d{2}\:\d{2}.([0-9A-Za-z]{6}-[0-9A-Za-z]{6}-[0-9A-Za-z]{2}).(.+)'
#exim_match += r'([0-9A-Za-z]{6}-[0-9A-Za-z]{6}-[0-9A-Za-z]{2}).(.+)'
exim_match += r'([0-9A-Za-z]{6}-[0-9A-Za-z]{6}-[0-9A-Za-z]{2}).(.+)'
"""Regex to match the (1) Message ID and the (2) Log Message"""

# sendmail regexp
sendm_match = r'([A-Za-z]+[ \t]+[0-9]+[ \t]+[0-9]+\:[0-9]+:[0-9]+).*'
"""(0) Regex to match the Date/Time at the start of each log line"""
#sendm_match += r'([0-9A-Za-z]{14})\:[ \t]+?(.*)'
sendm_match += r'\:\s([0-9A-Za-z]+)\:[ \t]+?(.*)'
"""Regex to match the (1) Queue ID and the (2) Log Message"""

# echange regexp
exch_match = r'^([A-Za-z]+[ \t]+[0-9]+[ \t]+[0-9]+\:[0-9]+:[0-9]+|\d{4}-\d{2}-\d{2}.\d{2}\:\d{2}\:\d{2})'
"""(0) Regex to match the Date/Time at the start of each log line"""
exch_match += r'([^#]([^,]*,){12}.+)'
"""Regex to match the (2) message ID and the (1) Log Message"""

if settings.mta == '': settings.mta = 'postfix'

if settings.mta == 'postfix':
    _match = postf_match
elif settings.mta == 'exim':
    _match = exim_match
elif settings.mta == 'sendmail':
    _match = sendm_match
elif settings.mta == 'exchange':
    _match = exch_match
else:
    log.exception('Incorrect value of MTA env variable: %s. Check example and set the correct one!', settings.mta)
    exit()

match = re.compile(_match)


class ObjectExists(BaseException):
    pass


class OnConflict(Enum):
    QUIET = "quiet"
    EXCEPT = "except"
    UPDATE = "update"


async def save_obj(table, data, primary=None, onconflict: OnConflict = OnConflict.EXCEPT):
    r, conn, _ = await get_rethink()
    _data = dict(data)
    if primary is not None:
        if 'id' not in _data: _data['id'] = _data[primary]
        g = await r.table(table).get(data[primary]).run(conn, array_limit=settings.rethink_arr_limit)

        if g is not None:
            if onconflict == OnConflict.QUIET:
                return None
            if onconflict == OnConflict.EXCEPT:
                raise ObjectExists(f"Table '{table}' entry with '{primary} = {data[primary]}' already exists!")
            if onconflict == OnConflict.UPDATE:
                return await r.table(table).get(data[primary]).update(_data).run(conn, array_limit=settings.rethink_arr_limit)
            raise AttributeError("'saveobj' onconflict must be either 'quiet', 'except', or 'update'")
    return await r.table(table).insert(_data).run(conn, array_limit=settings.rethink_arr_limit)

""" samoilov housekeeping function"""
async def housekeeping(housekeeping_days):
    tod = datetime.now()
    d = timedelta(days = housekeeping_days)
    a = (tod - d).replace(tzinfo=timezone.utc)
    log.info('According to the configured housekeeping days variable there will be deleted all logs before %s', a)
    result = {}
    log.info('Making DB cleanup query')
    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query
    _sm = r.table('sent_mail')
    _sm = _sm.filter(r_q.row["timestamp"] <= a).delete()
    _sm = await _sm.run(conn, array_limit=settings.rethink_arr_limit)

    #print (_sm)
    #print (_sm['deleted'])
    
    """sm = []
    if type(_sm) is list:
        sm = list(_sm)
    else:
        async for s in _sm:
            sm.append(dict(s))"""
    

    
    #result['deleted'] = len(sm)
    result['deleted'] = _sm['deleted']

    if result['deleted'] != 0:
        result['status'] = 'true'
    else:
        result['status'] = 'false'

    return result

async def import_log(logfile: str) -> Dict[str, PostfixMessage]:
    log.info('Opening log file %s', logfile)
    messages = {}
    multiple_recipients = []
    counter = 0
    same_qid = ''
    # avoid utf-8 codec error
    with open(logfile, 'rb') as f:
        while True:
        	#print("Hi!")
            line = f.readline().decode(errors='replace')
            if not line: break
            m = match.match(line)
            if not m: continue

            '''if settings.mta == 'exchange':
			    dtime, msg, qid  = m.groups()
            else:
                dtime, qid, msg = m.groups()'''
            if settings.mta == 'exchange':
            	dtime, msg, qid  = m.groups()
            	qid = qid[:-1]
            else:
            	dtime, qid, msg  = m.groups()
            #log.info(qid)
            #dtime, msg, qid  = m.groups()

            """Thu Mar 09 2023 14:13:35 GMT+00:00    ----     '%a %b %d %Y %H:%M:%S %Z' """
            """Mar 13 10:57:04
            dtime = datetime.strptime(dtime, '%b %d %H:%M:%S').replace(year=datetime.today().year).strftime('%d.%m.%Y-%H:%M:%S')
            print("New time stamp: "+ dtime)"""
            #log.info(m)
            #print("m.groups[1]: ",m.groups()[1])# - queue_id
            #print("m.groups[2]: ",m.groups()[2])# - message
            # merge multiple mail_to strings into one for the one queue_id

                #m['mail_to'] += ", "+recipients
                #print("mail_to: ",m['mail_to'])
            #print("mail_to: ",m['mail_to'])
            if qid not in messages:
                messages[qid] = PostfixMessage(timestamp=dtime, queue_id=qid)
            messages[qid].merge(await parse_line(msg))
            #print(messages[qid])
            #print(msg)
            checking_mailto = messages[qid]['mail_to']
            if qid not in set(multiple_recipients):
                if qid == same_qid or same_qid == '':
                    if messages[qid]['status'].get('code') is not None:
                        # check if there are already recipients in message and there are recipients parsed
                        #print("Looking for ",checking_mailto," in message \"",msg, "\" related to qid ", qid)
                        if checking_mailto != '':
                            if checking_mailto in msg:
                                same_qid = qid
                                counter += 1
                else:
                    #print("New message ID: ", qid)
                    #print("There are", counter,"recipients in message id",same_qid)
                    if counter > 1:
                        multiple_recipients.append(same_qid)
                    counter = 0
                    same_qid = ''

            #print(await parse_line(msg[1]))
            messages[qid].lines.append(PostfixLog(timestamp=dtime, queue_id=qid, message=msg))
            
    #print(multiple_recipients)
    #print(messages)
    log.info('Finished parsing log file %s', logfile)
    output = dict();
    output['messages'] = messages
    output['multiple_recipients'] = multiple_recipients
    return output

""" samoilov subject decoder fixed"""
#pat2=re.compile(r'(([^=]*)=\?([^\?]*)\?([BbQq])\?([^\?]*)\?=([^=]*))',re.IGNORECASE)
pat2=re.compile(r'(([^=]*)=\?([^\?]*)\?([BbQq])\?([^\?]*)([^=]*))',re.IGNORECASE)

def decodev2(a):
    data=pat2.findall(a)
    line=[]
    if data:
            for g in data:
                    (raw,extra1,encoding,method,string,extra)=g
                    extra1=extra1.replace('\r','').replace('\n','').strip()
                    if len(extra1)>0:
                            line.append(extra1)
                    if method.lower()=='q':
                            string=quopri.decodestring(string)
                            """string=string.replace("_"," ").strip()"""
                    if method.lower()=='b':
                            # samoilov fix of padding errors
                            #string=base64.b64decode(string)
                            #check_dupl = string.split('UTF-8')
                            #log.info(check_dupl)
                            string = f"{string}{'=' * (len(string) % 4)}"
                            string = base64.b64decode(string)
                    line.append(string.decode(encoding,errors='ignore'))
                    extra=extra.replace('\r','').replace('\n','').strip()
                    if len(extra)>0:
                            line.append(extra)
            return "".join(line)

    else:
            return a

#async def check_recipient(qid,mailto):
#    log.info('Checking %s in message %s', mailto, qid)
#    r, conn, r_q = await get_rethink()
#    r_q: rethinkdb.query
#    _sm = r.table('sent_mail')
#   #_sm = _sm.filter(r_q.row["queue_id"] == qid).pluck("mail_to")
#    _sm = await _sm.filter((r_q.row["mail_to"].match(mailto))&(r_q.row["queue_id"].match(qid))).is_empty().run(conn, array_limit=settings.rethink_arr_limit)
#    return _sm

async def main():
    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query
    """housekeeping from old logs"""

    housekeeping_days = settings.housekeeping_days
    if housekeeping_days != '':
        log.info('Start housekeeping')
        hk_result = await housekeeping(housekeeping_days)
        log.info('Finished housekeeping')
        if hk_result['status']=='true':
            log.info('Housekeeping has successfully deleted %d messages older then %d day(s)', hk_result['deleted'], housekeeping_days)
        else:
            log.info('Housekeeping has deleted NOTHING. There are no emails %d day(s) ago or something went wrong.', housekeeping_days)
    else:
        log.info('Housekeeping is not configured so there will be no deletion of old data! Pay attention to the disk space!')
    log.info('Importing %s log file', settings.mta)
    import_output = await import_log(settings.mail_log)
    log.info('Converting %s log data into list',settings.mta)
    multiple_recipients = import_output['multiple_recipients']
    msgs = import_output['messages']
    msg_list = [{"id": qid, **msg.clean_dict(convert_time=r_q.expr)} for qid, msg in msgs.items()]
    log.info('Total of %d message entries', len(msg_list))
    log.info('Generating async batch save list')
    save_list = []
    for m in msg_list:
        try:
            # check and process status
            if m['status'] != {}:                
                if m['status']['code'] not in ['sent','reject','deferred','bounced','multiple']:
                    if m['status']['message'] == '':
                        m['status']['message'] == 'no status message found'
                    else:
                        m['status']['message'] = m['status']['code'] + m['status']['message']
                    m['status']['code'] = "unknown"
            else:
                m['status']['code'] = "unknown"
                m['status']['message'] = "no status message found"
            """subject decoder"""
            try:
                m['subject'] = decodev2(m.get('subject'))
            except:
                m['subject'] = m.get('subject')
            mfrom, mto = m.get('mail_from'), m.get('mail_to')
            """samoilov to fix index out of range error"""

            if mfrom != '':
                if '<>' not in mfrom:
                    if '@' in mfrom:
                        mfrom_dom = mfrom.split('@')[1]
                    else:
                        mfrom_dom = ''
            else:
                mfrom_dom = mfrom
            
            if mto != '':
                if '@' in mfrom:
                    mto_dom = mto.split('@')[1]
                else:
                    mto_dom = ''
            else:
                mto_dom = mto

            if mfrom_dom in settings.ignore_domains or mto_dom in settings.ignore_domains:
                continue
            # check if there are many recipients
            if m.get('id') in set(multiple_recipients):
                print("There multiple recipients in ",m.get('id'))
                m['mail_to'] += " and more (check log lines)"
                m['status']['code'] = 'multiple'
                m['status']['message'] = 'multiple, see log lines below'

            save_list.append(save_obj('sent_mail', m, primary="id", onconflict=OnConflict.UPDATE))
        except Exception:
            log.exception('Error while parsing email %s', m)

    log.info('Firing off asyncio.gather(save_list)...')
    await asyncio.gather(*save_list)

    log.info('Finished!')

