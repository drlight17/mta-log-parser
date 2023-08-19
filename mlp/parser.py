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
import re
from mlp import settings
import logging
log = logging.getLogger(__name__)

# postfix regexp
postf_to = re.compile(r'.*to=<([a-zA-Z0-9-+_.=]+@[a-zA-Z0-9-+_.]+)>')
postf_from = re.compile(r'.*from=<([a-zA-Z0-9-+_.=]+@[a-zA-Z0-9-+_.]+)>')
postf_subject = re.compile(r'.*header\sSubject:\s(.*)\sfrom\s')
postf_size = re.compile(r'.*size=([0-9]{1,}),.*')
postf_message_id = re.compile(r'.*message-id=<(.*)>')
postf_status = re.compile(r'.*status=([a-zA-Z0-9-_.]+) (.*)?|.*(reject):\s.*:\s([0-9].*);\s')
postf_relay = re.compile(r'.*relay=([a-zA-Z0-9-._]+)\[(.*)\]:([0-9]+)')
postf_client = re.compile(r'.*client=([a-zA-Z0-9-._]+)\[(.*)\]')

# exim regexp
exim_to = re.compile(r'.*>.(.*).R=')
exim_from = re.compile(r'.*<=.(.*).H=|.*F=<(.*)>')
#exim_from = re.compile(r'.*<=.(.*).H=|.*F=<(.*)>|.*\*\*.(.*).R=')
exim_subject = re.compile(r'.*Subject:\s(.*)')
exim_size = re.compile(r'.*S=([0-9]{1,}).*')
exim_message_id = re.compile(r'.*<=.*id=(.*)')
exim_client = re.compile(r'.*<=.*H=([a-zA-Z0-9-._]+).*\[([a-zA-Z0-9.:]+)')
exim_relay = re.compile(r'.*=>.*T=(dovecot)|.*T=remote_smtp.*H=([a-zA-Z0-9-._]+).\[([a-zA-Z0-9.:]+)')
exim_status = re.compile(r'.*(rejected).(.*)|(.>{1}).*T=(.*)|.*(\*\*).(.*)|.*(==).*T.*:.(.*)')

# sendmail regexp
sendm_to = re.compile(r'.*to=(.*), ctladdr')
sendm_from = re.compile(r'.*from=(.*), size')
sendm_subject = re.compile(r'.*\(Subject:\s(.*)')
sendm_size = re.compile(r'.*size=([0-9]{1,}),.*')
sendm_message_id = re.compile(r'.*msgid=<(.*)>')
sendm_status = re.compile(r'.*stat=([a-zA-Z0-9-_.]+)(.*)?|.*(reject)=([0-9].*)')
sendm_relay = re.compile(r'.*to=.*relay=(.*)\[(.*)\], dsn|.*to=.*relay=(.*), dsn')
sendm_client = re.compile(r'.*from=.*relay=(.*)\[(.*)\]|.*from=.*relay=(.*)')

if settings.mta == 'postfix' or settings.mta == '':
    find_to = postf_to
    find_from = postf_from
    find_subject = postf_subject
    find_size = postf_size
    find_client = postf_client
    find_relay = postf_relay
    find_status = postf_status
    find_message_id = postf_message_id

elif settings.mta == 'exim':
    find_to = exim_to
    find_from = exim_from
    find_subject = exim_subject
    find_size = exim_size
    find_client = exim_client
    find_relay = exim_relay
    find_status = exim_status
    find_message_id = exim_message_id

elif settings.mta == 'sendmail':
    find_to = sendm_to
    find_from = sendm_from
    find_subject = sendm_subject
    find_size = sendm_size
    find_client = sendm_client
    find_relay = sendm_relay
    find_status = sendm_status
    find_message_id = sendm_message_id
else:
    log.exception('Incorrect value of MTA env variable: %s. Check example and set the correct one!', settings.mta)
    exit()


async def parse_line(mline) -> dict:
    lm = {}

    _to = find_to.match(mline)
    _from = find_from.match(mline)
    _subject = find_subject.match(mline)
    _size = find_size.match(mline)
    _client = find_client.match(mline)
    _relay = find_relay.match(mline)
    _status = find_status.match(mline)
    
    if _to is not None: lm['mail_to'] = _to.group(1)
    if _subject is not None: lm['subject'] = _subject.group(1)
    if _size is not None: lm['size'] = round(float(_size.group(1))/1024, 2)
    """print(_client)
    if _client is not None: 
        lm['client'] = dict(host=_client.group(1), ip=_client.group(2))
        print(lm['client'])"""


    if settings.mta == 'exim':
        if _relay is not None:
            if _relay.group(1) is not None:
                lm['relay'] = dict(host=_relay.group(1), ip="127.0.0.1")
            else:
                lm['relay'] = dict(host=_relay.group(2), ip=_relay.group(3))
        if _client is not None: lm['client'] = dict(host=_client.group(1), ip=_client.group(2))
        if _from is not None:
            if _from.group(1) is not None:
                lm['mail_from'] = _from.group(1)
            if _from.group(2) is not None:
                lm['mail_from'] = _from.group(2)
        if _status is not None:
            if _status.group(1) is not None:
                lm['status'] = dict(code=_status.group(1), message="")
            if _status.group(3) is not None:
                lm['status'] = dict(code=_status.group(3), message="")
            if _status.group(5) is not None:
                lm['status'] = dict(code=_status.group(5), message="")
            if _status.group(7) is not None:
                lm['status'] = dict(code=_status.group(7), message="")
            
            if lm['status']['code'] == '=>' or lm['status']['code'] == '->':
                lm['status']['code'] = 'sent'
            elif lm['status']['code'] == 'rejected':
                lm['status']['code'] = 'reject'
            elif lm['status']['code'] == '**':
                lm['status']['code'] = 'bounced'
            elif lm['status']['code'] == '==':
                lm['status']['code'] = 'deferred'

            if _status.group(2) is not None:
                lm['status']['message'] = _status.group(2)
            if _status.group(4) is not None:
                lm['status']['message'] = _status.group(4)
            if _status.group(6) is not None:
                lm['status']['message'] = _status.group(6)
            if _status.group(8) is not None:
                lm['status']['message'] = _status.group(8)

    elif settings.mta == 'postfix':
        if _relay is not None: lm['relay'] = dict(host=_relay.group(1), ip=_relay.group(2), port=_relay.group(3))
        if _client is not None: lm['client'] = dict(host=_client.group(1), ip=_client.group(2))
        if _from is not None: lm['mail_from'] = _from.group(1)
        if _status is not None:
            if _status.group(1) is not None: lm['status'] = dict(code=_status.group(1), message="")
            if _status.group(3) is not None: lm['status'] = dict(code=_status.group(3), message="")
            if _status.group(2) is not None: lm['status']['message'] = _status.group(2)
            if _status.group(4) is not None: lm['status']['message'] = _status.group(4)

    elif settings.mta == 'sendmail':
        if _from is not None: lm['mail_from'] = _from.group(1)
        if _client is not None:
            if _client.group(3) is not None:
                lm['client'] = dict(host=_client.group(3), ip="unknown")
            else:
                lm['client'] = dict(host=_client.group(1), ip=_client.group(2))
        if _relay is not None:
            if _relay.group(3) is not None:
                lm['relay'] = dict(host=_relay.group(3), ip="unknown")
            else:
                lm['relay'] = dict(host=_relay.group(1), ip=_relay.group(2))
            #lm['relay'] = dict(host=_relay.group(1), ip=_relay.group(2))
        if _status is not None:
            if _status.group(1) is not None: lm['status'] = dict(code=_status.group(1).lower(), message="")
            if _status.group(3) is not None: lm['status'] = dict(code=_status.group(3).lower(), message="")
            if _status.group(2) is not None: lm['status']['message'] = _status.group(2)
            if _status.group(4) is not None: lm['status']['message'] = _status.group(4)
            #print("_status: ",lm['status'])
    

        """if _status.group(9) is not None:
            lm['status'] = dict(code=_status.group(9), message="")"""

        #print('status: ',lm['status']['code'],'string')
        # exim status code reassign


        """if len(_status.groups()) > 1:"""
        
        """if _status.group(10) is not None:
            lm['status']['message'] = _status.group(10)"""

    _message_id = find_message_id.match(mline)
    if _message_id is not None:
        lm['message_id'] = _message_id.group(1)
    #log.info(lm)
    return lm
