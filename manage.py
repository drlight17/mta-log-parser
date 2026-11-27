#!/usr/bin/env python3
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
    |          (+)  Yuri Samoilov (@drlight17)          |
    |                                                   |
    +===================================================+

"""
import argparse
import asyncio
import textwrap

class ErrHelpParser(argparse.ArgumentParser):
    def error(self, message):
        self.print_help()
        self.exit(2, f'{self.prog}: error: {message}\n')

help_text = textwrap.dedent('''\

    Commands:

        runserver         - Run the Quart dev server (DO NOT USE IN PRODUCTION. USE Hypercorn)
        parse             - Parse the mail log and import it into the DB

''')

parser = ErrHelpParser(
    description='MTA Log Parser',
    formatter_class=argparse.RawDescriptionHelpFormatter,
    epilog=help_text
)


subparser = parser.add_subparsers()


def runserver(opt):
    from mlp import settings
    from mlp.webui import app

    app.run(
        host=opt.host,
        port=opt.port,
        debug=settings.DEBUG
    )


def runparse(opt):
    from mlp.main import main
    asyncio.run(main())


p_run = subparser.add_parser('runserver', description='Run Quart dev server (DO NOT USE IN PRODUCTION. USE Hypercorn)')
p_run.add_argument('--port', help='Port to listen on', default=5222, type=int)
p_run.add_argument('--host', help='IP/Hostname to listen on', default='127.0.0.1')
p_run.set_defaults(func=runserver)

p_parse = subparser.add_parser('parse', description='Parse the mail log and import it into the DB')
p_parse.set_defaults(func=runparse)

args = parser.parse_args()

if 'func' in args:
    args.func(args)
else:
    parser.print_help()

