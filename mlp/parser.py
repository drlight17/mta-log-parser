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
import logging

from mlp import settings
from mlp.core import compile_env_regex

log = logging.getLogger(__name__)

# Postfix
postf_to = re.compile(r'^.*to=<([^>]*)>,.*orig_to=<([^>]*)>|^.*to=<([^>]*)>')
postf_from = re.compile(r'.*from=<([a-zA-Z0-9-+_.=]+@[a-zA-Z0-9-+_.]+)>')
postf_subject = re.compile(r'.*header\sSubject:\s?(.*)')
postf_size = re.compile(r'.*size=([0-9]{1,}),.*')
postf_message_id = re.compile(r'.*message-id=<(.*)>')
postf_status = re.compile(r'.*status=([a-zA-Z0-9-_.]+) (.*)?|.*(reject):\s.*:\s([0-9].*);\s')
postf_relay = re.compile(r'.*(?:relay|connect to).([a-zA-Z0-9-._]+)\[(.*)\]:([0-9]+)')
postf_client = re.compile(r'.*client.([a-zA-Z0-9-._]+)?\[(.*)\]')

# Exim
exim_to = re.compile(r'.*[>|\*|=]\s?(.*)\s<?([a-zA-Z0-9-+_.=]+@[a-zA-Z0-9-+_.]+).*[R|F]=(?:dnslookup|localuser)?|.*DATA:.*for.([a-zA-Z0-9-+_.=]+@[a-zA-Z0-9-+_.]+)')
exim_from = re.compile(r'.*<=.(.*).[U|H]=|.*F=<?([a-zA-Z0-9-+_.=]+@[a-zA-Z0-9-+_.]+)>?')
exim_subject = re.compile(r'.*[T]="(.*)".from')
exim_size = re.compile(r'.*\sS=([0-9]{1,}).*')
exim_message_id = re.compile(r'.*<=.*id=(.*)\s(?:T=)')
exim_client = re.compile(r'.*H=\[?([a-zA-Z0-9-\s()._]+)\]?\s\(?\[?([a-zA-Z0-9.\s()\[\]]+)\]?\)?:([0-9]{3,6}).[I=]')
exim_relay = re.compile(r'.*(?:T=remote_smtp)?[?:H|I]=(\(?[a-zA-Z0-9-._]+\)?)?.\[?([a-zA-Z0-9.:]+)\]?.([0-9]{2,3})\s')
exim_status = re.compile(r'.*(rejected).(.*)|(.>{1}).*\s(?:T|C)="?(.*)(?:"|S)|.*(\*\*).(.*)|.*(==).*(?:T=).*:\s(.*)')

# Sendmail
sendm_to = re.compile(r'.*to=(.*), ctladdr')
sendm_from = re.compile(r'.*from=(.*), size')
sendm_subject = re.compile(r'.*\(Subject:\s(.*)')
sendm_size = re.compile(r'.*size=([0-9]{1,}),.*')
sendm_message_id = re.compile(r'.*msgid=<(.*)>')
sendm_status = re.compile(r'.*stat=([a-zA-Z0-9-_.]+)(.*)?|.*(reject)=([0-9].*)')
sendm_relay = re.compile(r'.*to=.*relay=(.*)\[(.*)\], dsn|.*to=.*relay=(.*), dsn')
sendm_client = re.compile(r'.*from=.*relay=(.*)\[(.*)\]|.*from=.*relay=(.*)')

# Exchange
exch_to = re.compile(r'^[^#]([^,]*,){13}')
exch_from = re.compile(r'^[^#]([^,]*,){20}')
exch_subject = re.compile(r'^[^#]([^,]*,){19}')
exch_size = re.compile(r'^[^#]([^,]*,){15}')
exch_message_id = re.compile(r'^[^#]([^,]*,){11}')
exch_status = re.compile(r'^[^#]([^,]*,){9}([^,]*,){13}')
exch_relay = re.compile(r'^[^#]([^,]*,){5}([^,]*,){21}')
exch_client = re.compile(r'^[^#]([^,]*,){3}([^,]*,){22}')

_MTA_PATTERNS = {
    'postfix': (postf_to, postf_from, postf_subject, postf_size, postf_client,
                postf_relay, postf_status, postf_message_id),
    'exim': (exim_to, exim_from, exim_subject, exim_size, exim_client,
             exim_relay, exim_status, exim_message_id),
    'sendmail': (sendm_to, sendm_from, sendm_subject, sendm_size, sendm_client,
                 sendm_relay, sendm_status, sendm_message_id),
    'exchange': (exch_to, exch_from, exch_subject, exch_size, exch_client,
                 exch_relay, exch_status, exch_message_id),
}

_mta = settings.mta or 'postfix'
if _mta not in _MTA_PATTERNS:
    log.error('Incorrect value of MTA env variable: %s. Check example and set the correct one!', settings.mta)
    raise SystemExit(1)

(find_to, find_from, find_subject, find_size,
 find_client, find_relay, find_status, find_message_id) = _MTA_PATTERNS[_mta]

# .env overrides for the configured MTA; empty values keep the built-in patterns
find_to = compile_env_regex('PARSER_TO_REGEX', find_to.pattern)
find_from = compile_env_regex('PARSER_FROM_REGEX', find_from.pattern)
find_subject = compile_env_regex('PARSER_SUBJECT_REGEX', find_subject.pattern)
find_size = compile_env_regex('PARSER_SIZE_REGEX', find_size.pattern)
find_client = compile_env_regex('PARSER_CLIENT_REGEX', find_client.pattern)
find_relay = compile_env_regex('PARSER_RELAY_REGEX', find_relay.pattern)
find_status = compile_env_regex('PARSER_STATUS_REGEX', find_status.pattern)
find_message_id = compile_env_regex('PARSER_MESSAGE_ID_REGEX', find_message_id.pattern)


def _exim_status(lm: dict, status) -> None:
    if status is None:
        return
    code = status.group(1) or status.group(3) or status.group(5) or status.group(7)
    message = status.group(2) or status.group(4) or status.group(6) or status.group(8)
    if code is None:
        return
    code = {'=>': 'sent', '->': 'sent', 'rejected': 'reject',
            '**': 'bounced', '==': 'deferred'}.get(code, code)
    lm['status'] = dict(code=code, message=message or '')


def _exchange_status(lm: dict, status) -> None:
    if status is None or status.group(1) is None:
        return
    value = status.group(1)[:-1].lower()
    if any(k in value for k in ('deliver', 'receive', 'redirect', 'send', 'submit')) or value == 'process':
        lm['status'] = dict(code='sent', message='')
    elif any(k in value for k in ('fail', 'discard', 'reject')) or value in ('suppressed', 'drop'):
        lm['status'] = dict(code='reject', message='')
    elif value == 'dsn':
        lm['status'] = dict(code='bounced', message='')
    elif 'defer' in value:
        lm['status'] = dict(code='deferred', message='')
    else:
        return
    if status.group(2) is not None and status.group(2)[:-1] != '':
        lm['status']['message'] = status.group(2)[:-1]


def _postfix_subject(value: str) -> str:
    # Postfix appends " from <client>[<ip>]; from=<sender> to=<recipient> ..." to header lines
    parts = re.split(r';\s*from=', value, maxsplit=1)
    if len(parts) == 2:
        value = re.sub(r'\s+from\s+\S+(?:\[[^\]]*\])?\s*$', '', parts[0])
    return value.strip()


async def parse_line(mline) -> dict:
    lm = {}

    _to = find_to.match(mline)
    _from = find_from.match(mline)
    _subject = find_subject.match(mline)
    _size = find_size.match(mline)
    _client = find_client.match(mline)
    _relay = find_relay.match(mline)
    _status = find_status.match(mline)

    if _to is not None:
        if _mta == 'exchange':
            lm['mail_to'] = _to.group(1)[:-1]
        elif _mta in ('exim', 'postfix'):
            if _to.group(3) is not None:
                lm['mail_to'] = _to.group(3)
            elif _to.group(1):
                if '@' not in _to.group(1) and '@' in (_to.group(2) or ''):
                    to_check = _to.group(1) + '@' + _to.group(2).split('@')[1]
                else:
                    to_check = _to.group(1)
                if _to.group(2) != to_check:
                    lm['mail_to_alias'] = {to_check: _to.group(2)}
                lm['mail_to'] = to_check
            else:
                lm['mail_to'] = _to.group(2)
        elif _to.group(2) is not None:
            lm['mail_to'] = _to.group(2)
        else:
            lm['mail_to'] = _to.group(1)

    if _subject is not None:
        subject = _subject.group(1)[:-1] if _mta == 'exchange' else _subject.group(1)
        if _mta == 'postfix':
            subject = _postfix_subject(subject)
        lm['subject'] = subject

    if _size is not None:
        raw_size = _size.group(1)[:-1] if _mta == 'exchange' else _size.group(1)
        lm['size'] = round(float(raw_size) / 1024, 2)

    if _mta == 'exim':
        if _relay is not None:
            lm['relay'] = dict(host=_relay.group(1), ip=_relay.group(2), port=_relay.group(3))
        if _client is not None:
            host = re.sub(r'[^A-Za-z0-9 .]+', '', _client.group(1))
            ip = re.sub(r'[^A-Za-z0-9 .]+', '', _client.group(2))
            if _client.group(3):
                ip = f'{ip}:{_client.group(3)}'
            lm['client'] = dict(host=host, ip=ip)
        if _from is not None:
            lm['mail_from'] = _from.group(2) or _from.group(1)
        _exim_status(lm, _status)

    elif _mta == 'exchange':
        if _from is not None:
            lm['mail_from'] = _from.group(1)[:-1]
        if _relay is not None:
            lm['relay'] = dict(host=_relay.group(1)[:-1], ip=_relay.group(2)[:-1])
        if _client is not None:
            lm['client'] = dict(host=_client.group(1)[:-1], ip=_client.group(2)[:-1])
        _exchange_status(lm, _status)

    elif _mta == 'postfix':
        if _relay is not None:
            lm['relay'] = dict(host=_relay.group(1), ip=_relay.group(2), port=_relay.group(3))
        if _client is not None:
            lm['client'] = dict(host=_client.group(1), ip=_client.group(2))
        if _from is not None:
            lm['mail_from'] = _from.group(1)
        if _status is not None:
            if _status.group(1) is not None:
                lm['status'] = dict(code=_status.group(1), message='')
            if _status.group(3) is not None:
                lm['status'] = dict(code=_status.group(3), message='')
            if 'status' in lm:
                if _status.group(2) is not None:
                    lm['status']['message'] = _status.group(2)
                if _status.group(4) is not None:
                    lm['status']['message'] = _status.group(4)

    elif _mta == 'sendmail':
        if _from is not None:
            lm['mail_from'] = _from.group(1)
        if _client is not None:
            if _client.group(3) is not None:
                lm['client'] = dict(host=_client.group(3), ip='unknown')
            else:
                lm['client'] = dict(host=_client.group(1), ip=_client.group(2))
        if _relay is not None:
            if _relay.group(3) is not None:
                lm['relay'] = dict(host=_relay.group(3), ip='unknown')
            else:
                lm['relay'] = dict(host=_relay.group(1), ip=_relay.group(2))
        if _status is not None:
            if _status.group(1) is not None:
                lm['status'] = dict(code=_status.group(1).lower(), message='')
            if _status.group(3) is not None:
                lm['status'] = dict(code=_status.group(3).lower(), message='')
            if 'status' in lm:
                if _status.group(2) is not None:
                    lm['status']['message'] = _status.group(2)
                if _status.group(4) is not None:
                    lm['status']['message'] = _status.group(4)

    _message_id = find_message_id.match(mline)
    if _message_id is not None:
        value = _message_id.group(1)
        lm['message_id'] = value[:-1] if _mta == 'exchange' else value

    return lm
