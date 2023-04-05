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
from postfixparser import settings
import logging
log = logging.getLogger(__name__)

# postfix regexp
"""""samoilov to fix domain and local parts of from and to addresses"""
"""find_to = re.compile(r'.*to=<([a-zA-Z0-9-_.]+@[a-zA-Z0-9-_.]+)>')
find_from = re.compile(r'.*from=<([a-zA-Z0-9-_.]+@[a-zA-Z0-9-_.]+)>')"""
postf_to = re.compile(r'.*to=<([a-zA-Z0-9-+_.=]+@[a-zA-Z0-9-+_.]+)>')
postf_from = re.compile(r'.*from=<([a-zA-Z0-9-+_.=]+@[a-zA-Z0-9-+_.]+)>')
"""samoilov add subject and size"""
postf_subject = re.compile(r'.*header\sSubject:\s(.*)\sfrom\s')
postf_size = re.compile(r'.*size=([0-9]{1,}),.*')
postf_message_id = re.compile(r'.*message-id=<(.*)>')
"""samoilov add reject and milter-reject statuses to regexp"""
"""find_status = re.compile(r'.*status=([a-zA-Z0-9-_.]+) (.*)?')"""
postf_status = re.compile(r'.*status=([a-zA-Z0-9-_.]+) (.*)?|.*(reject):\s.*:\s([0-9].*);\s')
postf_relay = re.compile(r'.*relay=([a-zA-Z0-9-._]+)\[(.*)\]:([0-9]+)')
postf_client = re.compile(r'.*client=([a-zA-Z0-9-._]+)\[(.*)\]')

# exim regexp
exim_to = re.compile(r'.*to=<([a-zA-Z0-9-+_.=]+@[a-zA-Z0-9-+_.]+)>')
exim_from = re.compile(r'.*from=<([a-zA-Z0-9-+_.=]+@[a-zA-Z0-9-+_.]+)>')
exim_subject = re.compile(r'.*header\sSubject:\s(.*)\sfrom\s')
exim_size = re.compile(r'.*size=([0-9]{1,}),.*')
exim_message_id = re.compile(r'.*message-id=<(.*)>')
exim_status = re.compile(r'.*status=([a-zA-Z0-9-_.]+) (.*)?|.*(reject):\s.*:\s([0-9].*);\s')
exim_relay = re.compile(r'.*relay=([a-zA-Z0-9-._]+)\[(.*)\]:([0-9]+)')
exim_client = re.compile(r'.*client=([a-zA-Z0-9-._]+)\[(.*)\]')

# sendmail regexp
sendm_to = re.compile(r'.*to=<([a-zA-Z0-9-+_.=]+@[a-zA-Z0-9-+_.]+)>')
sendm_from = re.compile(r'.*from=<([a-zA-Z0-9-+_.=]+@[a-zA-Z0-9-+_.]+)>')
sendm_subject = re.compile(r'.*header\sSubject:\s(.*)\sfrom\s')
sendm_size = re.compile(r'.*size=([0-9]{1,}),.*')
sendm_message_id = re.compile(r'.*message-id=<(.*)>')
sendm_status = re.compile(r'.*status=([a-zA-Z0-9-_.]+) (.*)?|.*(reject):\s.*:\s([0-9].*);\s')
sendm_relay = re.compile(r'.*relay=([a-zA-Z0-9-._]+)\[(.*)\]:([0-9]+)')
sendm_client = re.compile(r'.*client=([a-zA-Z0-9-._]+)\[(.*)\]')

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

    if _to is not None: lm['mail_to'] = _to.group(1)
    if _from is not None: lm['mail_from'] = _from.group(1)
    if _subject is not None: lm['subject'] = _subject.group(1)
    if _size is not None: lm['size'] = round(float(_size.group(1))/1024, 2)
    if _client is not None: lm['client'] = dict(host=_client.group(1), ip=_client.group(2))
    if _relay is not None: lm['relay'] = dict(host=_relay.group(1), ip=_relay.group(2), port=_relay.group(3))

    _status = find_status.match(mline)
    if _status is not None:
        if _status.group(1) is not None:
            lm['status'] = dict(code=_status.group(1), message="")
        if _status.group(3) is not None:
            lm['status'] = dict(code=_status.group(3), message="")

        """if len(_status.groups()) > 1:"""
        if _status.group(2) is not None:
            lm['status']['message'] = _status.group(2)
        if _status.group(4) is not None:
            lm['status']['message'] = _status.group(4)

    _message_id = find_message_id.match(mline)
    if _message_id is not None:
        lm['message_id'] = _message_id.group(1)

    return lm
