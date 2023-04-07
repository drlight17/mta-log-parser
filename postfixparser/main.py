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
from postfixparser import settings
from postfixparser.core import get_rethink
from postfixparser.objects import PostfixLog, PostfixMessage
from postfixparser.parser import parse_line
import email
import base64
import quopri
from datetime import datetime, timedelta, timezone
from quart import jsonify

log = logging.getLogger(__name__)


_match = r'([A-Za-z]+[ \t]+[0-9]+[ \t]+[0-9]+\:[0-9]+:[0-9]+).*'
"""(0) Regex to match the Date/Time at the start of each log line"""

_match += r'([A-F0-9]{11})\:[ \t]+?(.*)'
"""Regex to match the (1) Queue ID and the (2) Log Message"""

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
        g = await r.table(table).get(data[primary]).run(conn)

        if g is not None:
            if onconflict == OnConflict.QUIET:
                return None
            if onconflict == OnConflict.EXCEPT:
                raise ObjectExists(f"Table '{table}' entry with '{primary} = {data[primary]}' already exists!")
            if onconflict == OnConflict.UPDATE:
                return await r.table(table).get(data[primary]).update(_data).run(conn)
            raise AttributeError("'saveobj' onconflict must be either 'quiet', 'except', or 'update'")
    return await r.table(table).insert(_data).run(conn)

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
    _sm = await _sm.run(conn)

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
    with open(logfile, 'r') as f:
        while True:
            line = f.readline()
            if not line: break

            m = match.match(line)
            if not m: continue

            dtime, qid, msg = m.groups()
            """Thu Mar 09 2023 14:13:35 GMT+00:00    ----     '%a %b %d %Y %H:%M:%S %Z' """
            """Mar 13 10:57:04
            dtime = datetime.strptime(dtime, '%b %d %H:%M:%S').replace(year=datetime.today().year).strftime('%d.%m.%Y-%H:%M:%S')
            print("New time stamp: "+ dtime)"""

            if qid not in messages:
                messages[qid] = PostfixMessage(timestamp=dtime, queue_id=qid)
            

            messages[qid].merge(await parse_line(msg))
            """print(await parse_line(msg))"""
            messages[qid].lines.append(PostfixLog(timestamp=dtime, queue_id=qid, message=msg))

    log.info('Finished parsing log file %s', logfile)
    return messages

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
    log.info('Importing log file')
    msgs = await import_log(settings.mail_log)
    log.info('Converting log data into list')
    msg_list = [{"id": qid, **msg.clean_dict(convert_time=r_q.expr)} for qid, msg in msgs.items()]
    log.info('Total of %d message entries', len(msg_list))
    log.info('Generating async batch save list')
    save_list = []
    for m in msg_list:
        try:
            """samoilov subject decoder"""
            m['subject'] = decodev2(m.get('subject'))
            mfrom, mto = m.get('mail_from'), m.get('mail_to')
            """if mfrom == 'zabbix@kgilc.ru':
                log.info(m.get('subject'))"""
            """samoilov to fix index out of range error"""
            if mfrom != '': mfrom_dom = mfrom.split('@')[1]
            if mto != '': mto_dom = mto.split('@')[1]

            if mfrom_dom in settings.ignore_domains or mto_dom in settings.ignore_domains:
                continue
            save_list.append(save_obj('sent_mail', m, primary="id", onconflict=OnConflict.UPDATE))
        except Exception:
            log.exception('Error while parsing email %s', m)

    log.info('Firing off asyncio.gather(save_list)...')
    await asyncio.gather(*save_list)

    log.info('Finished!')

