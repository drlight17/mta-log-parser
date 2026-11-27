from dataclasses import dataclass, field, fields
from datetime import datetime
from typing import List

import moment
from dateutil.parser import parse

from mlp.settings import log_timezone
from mlp import settings


class Dictable:
    def keys(self):
        return [item.name for item in fields(self)]

    def __getitem__(self, key):
        return getattr(self, key)

    def __setitem__(self, key, value):
        setattr(self, key, value)

    def get(self, key, default=None):
        return getattr(self, key, default)


def _is_false(value) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in ('', '0', 'false', 'no', 'off')
    return not value

@dataclass
class PostfixLog(Dictable):
    timestamp: datetime
    queue_id: str
    message: str

    def __post_init__(self):
        if not isinstance(self.timestamp, datetime):
            self.timestamp = log_timezone.localize(parse(self.timestamp))
        self.message = self.message.strip()
        self.queue_id = self.queue_id.strip()

    def __repr__(self):
        return f'<PostfixLog timestamp="{self.timestamp}" queue_id="{self.queue_id}" message="{self.message}" />'

    def __str__(self):
        return self.__repr__()

    def clean_dict(self, convert_time=str) -> dict:
        data = dict(self)
        if settings.mail_log_timestamp_convert:
            data['timestamp'] = moment.date(str(self.timestamp)).format(settings.datetime_format)
        elif _is_false(convert_time):
            data['timestamp'] = self.timestamp
        else:
            data['timestamp'] = convert_time(self.timestamp)
        return data

@dataclass
class PostfixMessage(Dictable):
    timestamp: datetime
    queue_id: str
    lines: List[PostfixLog] = field(default_factory=list)
    mail_to: str = ""
    mail_to_alias: dict = field(default_factory=dict)
    mail_from: str = ""
    subject: str = ""
    size: float  = 0
    message_id: str = ""
    status: dict = field(default_factory=dict)
    relay: dict = field(default_factory=dict)
    client: dict = field(default_factory=dict)

    def __post_init__(self):
        if not isinstance(self.timestamp, datetime):
            self.timestamp = log_timezone.localize(parse(self.timestamp))
        self.queue_id = self.queue_id.strip()

    def __repr__(self):
        return f'<PostfixMessage timestamp="{self.timestamp}" queue_id="{self.queue_id}" status="{self.status}" />'

    def __str__(self):
        return self.__repr__()

    @property
    def first_attempt(self) -> datetime:
        return self.lines[0].timestamp if self.lines else self.timestamp

    @property
    def last_attempt(self) -> datetime:
        return self.lines[-1].timestamp if self.lines else self.timestamp

    def merge(self, dicdata: dict):
        for k, v in dicdata.items():
            if hasattr(self, k):
                setattr(self, k, v)

    def clean_dict(self, convert_time=str) -> dict:
        data = dict(self)
        if _is_false(convert_time):
            data['timestamp'] = self.timestamp
            data['first_attempt'], data['last_attempt'] = self.first_attempt, self.last_attempt
        else:
            data['timestamp'] = convert_time(self.timestamp)
            data['first_attempt'] = convert_time(self.first_attempt)
            data['last_attempt'] = convert_time(self.last_attempt)

        data['lines'] = [s.clean_dict(convert_time=convert_time) for s in self.lines]
        return data
