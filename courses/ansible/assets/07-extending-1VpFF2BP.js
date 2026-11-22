var e={id:`low-extending`,track:`low`,order:7,title:`Extending Ansible`,icon:`Puzzle`,hue:320,blurb:`When no module or filter does what you need, write your own: an idempotent Python module with check mode and diff, filter and lookup plugins, and a collection that packages them with sanity and unit tests.`,lessons:[{id:`l-custom-module`,title:`Writing a module`,duration:`30 min`,summary:`A module is a small program that Ansible copies to the managed host, runs with the task arguments, and reads JSON back from. In Python, AnsibleModule handles arguments, check mode, diff and results. A good module compares the current state with the wanted state and only changes something when they differ: that is what makes it idempotent.`,prereqs:[`l-collections`,`l-errors`],objectives:[`Define arguments and documentation for a Python module`,`Make the module idempotent and support check mode and diff`,`Use a module from a library/ directory next to the playbook`],docs:[{label:`Developing modules`,url:`https://docs.ansible.com/ansible/latest/dev_guide/developing_modules_general.html`},{label:`Module format and documentation`,url:`https://docs.ansible.com/ansible/latest/dev_guide/developing_modules_documenting.html`}],blocks:[{diagram:`sequenceDiagram
  participant C as Control node
  participant H as Managed host
  C->>H: copy module + arguments (one file, with module_utils)
  H->>H: AnsibleModule parses and validates arguments
  H->>H: read current state, compare with wanted state
  alt differs and not check mode
    H->>H: change it (atomically)
  end
  H-->>C: JSON: changed, diff, return values
  C->>C: show result, run handlers, register`,title:`What happens when a task calls a module`},{table:{head:[`Part`,`Purpose`],rows:[["`DOCUMENTATION`","YAML: options with types and defaults; `ansible-doc` and sanity tests read it"],["`EXAMPLES`, `RETURN`",`Usage examples and the values the module returns`],["`argument_spec`",`Types, required options, choices; Ansible validates input before your code runs`],["`required_if`, `mutually_exclusive` …",`Rules between options`],["`supports_check_mode=True`","Promise to change nothing when `module.check_mode` is true"],["`module._diff`","True with `--diff`: return `diff` with `before` and `after`"],["`exit_json` / `fail_json`",`Return the result or an error as JSON`]]}},{callout:"Write a module when a task would otherwise need `command` or `shell` with fragile `changed_when` logic, or when the same logic is repeated in many playbooks. If an existing module or a role can do it, use that: every module you write is code you have to test and maintain.",tone:`arch`}],lab:{title:`A module for JSON settings files`,goal:`Write a module that sets or removes one key in a JSON file, then show that it is idempotent and supports check mode and diff.`,duration:`25 min`,steps:[{title:`Write the module`,text:"Ansible looks for modules in a `library/` directory next to the playbook.",code:{lang:`python`,file:`library/json_setting.py`,code:`#!/usr/bin/python
# -*- coding: utf-8 -*-
# GNU General Public License v3.0+ (see https://www.gnu.org/licenses/gpl-3.0.txt)

from __future__ import annotations

DOCUMENTATION = r'''
module: json_setting
short_description: Manage one top-level setting in a JSON file
description:
  - Sets or removes one key in a JSON object file. The file is created when needed.
options:
  path:
    description: Path of the JSON file.
    type: path
    required: true
  key:
    description: Name of the top-level key.
    type: str
    required: true
  value:
    description: Value to set. Required when O(state=present).
    type: raw
  state:
    description: Whether the key should exist.
    type: str
    choices: [present, absent]
    default: present
author: Lab Team (@lab-team)
'''

EXAMPLES = r'''
- name: Set the log level of the app
  lab.platform.json_setting:
    path: /etc/lab-app/settings.json
    key: log_level
    value: debug
'''

RETURN = r'''
previous:
  description: Value of the key before the change, or null if it did not exist.
  returned: always
  type: raw
'''

import json
import os

from ansible.module_utils.basic import AnsibleModule


def main():
    module = AnsibleModule(
        argument_spec=dict(
            path=dict(type='path', required=True),
            key=dict(type='str', required=True, no_log=False),
            value=dict(type='raw'),
            state=dict(type='str', choices=['present', 'absent'], default='present'),
        ),
        required_if=[('state', 'present', ['value'])],
        supports_check_mode=True,
    )
    path, key, state = module.params['path'], module.params['key'], module.params['state']

    data = {}
    if os.path.exists(path):
        try:
            with open(path) as f:
                data = json.load(f)
        except ValueError as e:
            module.fail_json(msg=f'{path} is not valid JSON: {e}')
    if not isinstance(data, dict):
        module.fail_json(msg=f'{path} does not contain a JSON object')

    previous = data.get(key)
    wanted = dict(data)
    if state == 'present':
        wanted[key] = module.params['value']
    else:
        wanted.pop(key, None)

    changed = wanted != data
    result = dict(changed=changed, previous=previous)
    if changed and module._diff:
        result['diff'] = dict(
            before=json.dumps(data, indent=2, sort_keys=True) + '\\n',
            after=json.dumps(wanted, indent=2, sort_keys=True) + '\\n',
            before_header=path, after_header=path,
        )
    if changed and not module.check_mode:
        tmp = path + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(wanted, f, indent=2, sort_keys=True)
            f.write('\\n')
        module.atomic_move(tmp, path)
    module.exit_json(**result)


if __name__ == '__main__':
    main()`}},{title:`Read its documentation`,code:{lang:`bash`,code:`$ ansible-doc -M library json_setting | head -11
> MODULE json_setting (/home/ansible/lab/library/json_setting.py)

  Sets or removes one key in a JSON object file. The file is created
  when needed.

OPTIONS (red indicates it is required):

   key     Name of the top-level key.
        type: str

   path    Path of the JSON file.`}},{title:`Use it in a playbook`,code:{lang:`yaml`,file:`settings.yml`,code:`---
- name: Manage app settings with our own module
  hosts: web
  become: true
  gather_facts: false
  tasks:
    - name: Make sure the settings directory exists
      ansible.builtin.file:
        path: /etc/lab-app
        state: directory
        mode: "0755"

    - name: Set the log level
      json_setting:
        path: /etc/lab-app/settings.json
        key: log_level
        value: "{{ app_log_level | default('info') }}"

    - name: Set the listener from the inventory (a dictionary value)
      json_setting:
        path: /etc/lab-app/settings.json
        key: listen
        value:
          port: "{{ http_port | default(80) }}"
          tls: false

    - name: Remove an old setting
      json_setting:
        path: /etc/lab-app/settings.json
        key: legacy_mode
        state: absent`}},{title:`Run it twice, then preview a change`,code:{lang:`bash`,code:`$ ansible-playbook settings.yml --diff
$ ansible-playbook settings.yml | tail -3
node2                      : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
node3                      : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
$ ansible web -b -a 'cat /etc/lab-app/settings.json'
node2 | CHANGED | rc=0 >>
{
  "listen": {
    "port": 8000,
    "tls": false
  },
  "log_level": "info"
}
node3 | CHANGED | rc=0 >>
{
  "listen": {
    "port": 9000,
    "tls": false
  },
  "log_level": "info"
}
$ ansible-playbook settings.yml --check --diff -e app_log_level=debug
TASK [Set the log level] *******************************************************
--- before: /etc/lab-app/settings.json
+++ after: /etc/lab-app/settings.json
@@ -3,5 +3,5 @@
     "port": 8000,
     "tls": false
   },
-  "log_level": "info"
+  "log_level": "debug"
 }

changed: [node2]
...
$ ansible node2 -b -a 'grep log_level /etc/lab-app/settings.json'
node2 | CHANGED | rc=0 >>
  "log_level": "info"`}},{title:`Argument validation`,text:"`required_if` makes `value` required when `state` is `present`, before any of your code runs.",code:{lang:`bash`,code:`$ ansible node2 -M library -m json_setting -a 'path=/tmp/x.json key=a'
[ERROR]: Task failed: Module failed: state is present but all of the following are missing: value
...
node2 | FAILED! =>
    changed: false
    msg: 'state is present but all of the following are missing: value'`}}],verify:{text:'The first run changes three tasks on both web servers and shows a diff of the JSON; the second reports `changed=0`. node2 listens on port 8000 and node3 on 9000, from the inventory. The check run shows the `log_level` diff to `debug`, but the file still says `info`. The ad-hoc call fails with "state is present but all of the following are missing: value".'},solution:{text:'Idempotence comes from comparing `wanted` with `data` before writing anything. `atomic_move` replaces the file in one step, so a reader never sees half a file. `type: raw` keeps the value\'s type: the port is written as a number and `tls` as a boolean, because the module receives them as JSON types. "Remove an old setting" is `ok` because the key does not exist, which is the wanted state.'},challenge:"Add a `backup` option (type bool, default false): when true and the file changes, call `module.backup_local(path)` before writing and return the backup file name as `backup_file`. Document the option and the return value."},takeaways:[`AnsibleModule validates arguments from argument_spec and returns JSON`,`Compare current and wanted state; change only when they differ`,`Support check mode and diff so users can preview changes`]},{id:`l-plugins`,title:`Filter and lookup plugins`,duration:`20 min`,summary:`Modules run on managed hosts; plugins run inside Ansible on the control node. Filter plugins add Jinja2 filters for data transformations that would be clumsy in templates. Lookup plugins fetch data from outside the playbook: files, APIs, secret stores. Both are short Python files in a directory next to the playbook, or in a collection.`,prereqs:[`l-data-transformation`,`l-custom-module`],objectives:[`Write a filter plugin and call it in a template expression`,`Write a lookup plugin with options and documentation`,`Know the other plugin types and where Ansible finds plugins`],docs:[{label:`Developing plugins`,url:`https://docs.ansible.com/ansible/latest/dev_guide/developing_plugins.html`}],blocks:[{table:{head:[`Plugin type`,`Runs`,`Used for`,`Local directory`],rows:[[`Filter`,`On the control node, in templates`,"Data transformation: `{{ x | my_filter }}`","`filter_plugins/`"],[`Test`,`On the control node, in templates`,"Conditions: `{{ x is my_test }}`","`test_plugins/`"],[`Lookup`,`On the control node`,"Read external data: `lookup('my_lookup', …)`","`lookup_plugins/`"],[`Inventory`,`On the control node`,`Hosts and groups from a source`,"`inventory_plugins/`"],[`Callback`,`On the control node`,`React to events: output, notifications, profiling`,"`callback_plugins/`"],[`Action`,`On the control node, before the module`,"Work on the controller side (for example `template` renders locally)","`action_plugins/`"]]}},{p:"Lookups and filters always run on the control node, so a lookup reads files on the controller, not on the managed host. Ansible finds local plugins in directories next to the playbook (and in paths from `ansible.cfg`), and collection plugins by their full name, such as `community.general.json_query`."},{callout:`Plugins have full access to the control node and its credentials. Review them as carefully as any other code that runs with your automation's privileges.`,tone:`warn`}],lab:{title:`A merge filter and an env-file lookup`,goal:`Write a filter that merges two lists of dictionaries by a key, and a lookup that reads values from KEY=VALUE files on the control node.`,duration:`20 min`,steps:[{title:`Write the filter plugin`,code:{lang:`python`,file:`filter_plugins/lab_filters.py`,code:`# GNU General Public License v3.0+ (see https://www.gnu.org/licenses/gpl-3.0.txt)
from __future__ import annotations

from ansible.errors import AnsibleFilterError


def merge_by(left, right, key):
    """Merge two lists of dictionaries on a key; items in right update items in left."""
    if not all(isinstance(x, list) for x in (left, right)):
        raise AnsibleFilterError('merge_by expects two lists')
    merged = {item[key]: dict(item) for item in left}
    for item in right:
        merged.setdefault(item[key], {}).update(item)
    return list(merged.values())


class FilterModule:
    def filters(self):
        return {'merge_by': merge_by}`}},{title:`Write the lookup plugin`,code:{lang:`python`,file:`lookup_plugins/dotenv.py`,code:`# GNU General Public License v3.0+ (see https://www.gnu.org/licenses/gpl-3.0.txt)
from __future__ import annotations

DOCUMENTATION = r'''
name: dotenv
short_description: Read values from KEY=VALUE files on the control node
description:
  - Returns the value of O(key) from each file given as a term. Lines starting with V(#) are ignored.
options:
  _terms:
    description: Files to read, relative to the playbook's files/ directory or absolute.
    required: true
  key:
    description: The key to look up.
    type: str
    required: true
  default:
    description: Value returned when the key is missing. Without it, a missing key is an error.
    type: raw
'''

from ansible.errors import AnsibleError
from ansible.plugins.lookup import LookupBase


class LookupModule(LookupBase):
    def run(self, terms, variables=None, **kwargs):
        self.set_options(var_options=variables, direct=kwargs)
        key = self.get_option('key')
        results = []
        for term in terms:
            path = self.find_file_in_search_path(variables, 'files', term)
            values = {}
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        values[k.strip()] = v.strip()
            if key in values:
                results.append(values[key])
            elif self.get_option('default') is not None:
                results.append(self.get_option('default'))
            else:
                raise AnsibleError(f'{key} not found in {path}')
        return results`}},{title:`Add a data file`,text:"Lookups find relative file names in the `files/` directory next to the playbook.",code:{lang:`ini`,file:`files/app.env`,code:`# Settings for the app
DB_HOST=node4
DB_NAME=shop`}},{title:`Use both`,code:[{lang:`yaml`,file:`plugins.yml`,code:`---
- name: Use our own filter and lookup plugins
  hosts: localhost
  connection: local
  gather_facts: false
  vars:
    base_users:
      - { name: alice, shell: /bin/bash, groups: [wheel] }
      - { name: bob, shell: /bin/bash, groups: [] }
    site_users:
      - { name: bob, shell: /bin/zsh }
      - { name: dave, shell: /bin/bash, groups: [ops] }
  tasks:
    - name: Merge the site list into the base list
      ansible.builtin.debug:
        msg: "{{ base_users | merge_by(site_users, 'name') }}"

    - name: Read the database host from an env file
      ansible.builtin.debug:
        msg: "{{ lookup('dotenv', 'app.env', key='DB_HOST') }}"

    - name: A missing key with a default
      ansible.builtin.debug:
        msg: "{{ lookup('dotenv', 'app.env', key='DB_PORT', default='5432') }}"`},{lang:`bash`,code:`$ ansible-playbook plugins.yml
TASK [Merge the site list into the base list] **********************************
ok: [localhost] =>
    msg:
    -   groups:
        - wheel
        name: alice
        shell: /bin/bash
    -   groups: []
        name: bob
        shell: /bin/zsh
    -   groups:
        - ops
        name: dave
        shell: /bin/bash

TASK [Read the database host from an env file] *********************************
ok: [localhost] =>
    msg: node4

TASK [A missing key with a default] ********************************************
ok: [localhost] =>
    msg: '5432'
$ ANSIBLE_LOOKUP_PLUGINS=./lookup_plugins ansible-doc -t lookup dotenv | head -4
> LOOKUP dotenv (/home/ansible/lab/lookup_plugins/dotenv.py)

  Returns the value of \`key' from each file given as a term. Lines
  starting with \`#' are ignored.`}]}],verify:{text:"The merged list has alice unchanged, bob with `/bin/zsh` (from the site list) and his `groups: []` kept, and dave added. The lookup returns `node4` for `DB_HOST`, and `'5432'` for the missing `DB_PORT` because a default was given. `ansible-doc` shows the lookup's documentation; for plugins (unlike modules, where `-M` works) it finds local files through `ANSIBLE_LOOKUP_PLUGINS` and similar settings."},solution:{text:"`merge_by` builds a dictionary keyed by the merge key, so each name appears once and the order of first appearance is kept. `self.set_options(var_options=variables, direct=kwargs)` reads `key=` and `default=` and checks them against `DOCUMENTATION`. `find_file_in_search_path` looks in the playbook's `files/` directory, like the `file` lookup does."},challenge:"Add a test plugin `is_private_port` in `test_plugins/lab_tests.py` that is true for ports 1024 and above, and use it in a `selectattr` on a list of ports. Then make `dotenv` raise a clear `AnsibleError` when the file does not exist."},takeaways:[`Plugins run on the control node; modules run on managed hosts`,`Filters transform data in templates; lookups bring in external data`,`Give plugins DOCUMENTATION and options, like modules`]},{id:`l-collection-dev`,title:`Developing and testing a collection`,duration:`30 min`,summary:`A collection packages roles, modules and plugins under one name, with a version, so they can be shared and installed. ansible-test runs the checks that Ansible's own collections use: sanity tests for documentation, code style and imports, and unit tests with pytest. Build a release with ansible-galaxy and install it like any other collection.`,prereqs:[`l-plugins`,`l-testing`],objectives:[`Lay out a collection for development with ansible-test`,`Run sanity and unit tests and fix their findings`,`Version, build and install a new release`],docs:[{label:`Developing collections`,url:`https://docs.ansible.com/ansible/latest/dev_guide/developing_collections.html`},{label:`Testing collections (ansible-test)`,url:`https://docs.ansible.com/ansible/latest/dev_guide/testing.html`}],blocks:[{code:`ansible_collections/          # ansible-test needs this path: ansible_collections/<namespace>/<name>
└── lab/
    └── platform/
        ├── galaxy.yml           # name, version, dependencies, build_ignore
        ├── meta/runtime.yml     # requires_ansible, redirects, deprecations
        ├── plugins/
        │   ├── modules/         # json_setting.py → lab.platform.json_setting
        │   ├── filter/          # lab_filters.py  → lab.platform.merge_by
        │   └── lookup/          # dotenv.py       → lab.platform.dotenv
        ├── roles/               # common, nginx
        └── tests/
            └── unit/plugins/filter/test_lab_filters.py`,title:`A collection checkout ready for ansible-test`},{table:{head:[`Test`,`Checks`,`Command`],rows:[[`Sanity`,`Documentation against argument specs, imports, PEP 8, pylint, YAML, metadata, and more`,"`ansible-test sanity`"],[`Unit`,`Python functions and modules with pytest, without managed hosts`,"`ansible-test units`"],[`Integration`,"Modules against real or container targets, from `tests/integration/targets/`","`ansible-test integration`"]]}},{p:"ansible-test runs each test with its own pinned requirements. `--venv` installs them into virtual environments it manages (they need internet access the first time); `--docker` runs them in the ansible-test containers, which is what most collection CI pipelines use. For testing roles and playbooks against real instances, Molecule is the common tool."},{callout:"Bump the version for every release using semantic versioning: patch for fixes, minor for new modules or options, major for breaking changes. Users pin collection versions in `requirements.yml` and execution environments; an unchanged version with changed content breaks that trust.",tone:`arch`}],lab:{title:`Release lab.platform 1.1.0`,goal:`Move the module and plugins into the lab.platform collection, make it pass sanity and unit tests, and build and install version 1.1.0.`,duration:`30 min`,steps:[{title:`Create a development checkout`,text:"The collection source in `src/lab/platform` is not under an `ansible_collections/` path, which ansible-test requires. Copy it to `dev/ansible_collections/lab/platform` and move the plugins in.",code:{lang:`bash`,code:`$ mkdir -p dev/ansible_collections/lab && cp -r src/lab/platform dev/ansible_collections/lab/
$ cd dev/ansible_collections/lab/platform
$ mkdir -p plugins/modules plugins/filter plugins/lookup
$ cp ~/lab/library/json_setting.py plugins/modules/
$ cp ~/lab/filter_plugins/lab_filters.py plugins/filter/
$ cp ~/lab/lookup_plugins/dotenv.py plugins/lookup/
$ find plugins -name '*.py' | sort
plugins/filter/lab_filters.py
plugins/lookup/dotenv.py
plugins/modules/json_setting.py`}},{title:`Run the sanity tests`,text:`The first run installs the requirements of each test into virtual environments, which takes a minute.`,code:{lang:`bash`,code:`$ cd dev/ansible_collections/lab/platform
$ ansible-test sanity --venv --python 3.12 2>&1 | grep -E '^(ERROR|FATAL)'
ERROR: Found 3 import issue(s) on python 3.12 which need to be resolved:
ERROR: plugins/filter/lab_filters.py:0:0: traceback: ValueError: collection metadata was not loaded for collection lab.platform
ERROR: plugins/lookup/dotenv.py:0:0: traceback: ValueError: collection metadata was not loaded for collection lab.platform
ERROR: plugins/modules/json_setting.py:0:0: traceback: ValueError: collection metadata was not loaded for collection lab.platform
ERROR: Found 1 runtime-metadata issue(s) which need to be resolved:
ERROR: meta/runtime.yml:0:0: expected a dictionary. Got None
ERROR: Found 1 yamllint issue(s) which need to be resolved:
ERROR: galaxy.yml:70:1: empty-lines: too many blank lines (1 > 0)
FATAL: The 3 sanity test(s) listed below (out of 24) failed. See error output above for details.
...`}},{title:`Fix the findings`,text:"Both come from the skeleton that `ansible-galaxy collection init` generated: `meta/runtime.yml` contains only comments, and `galaxy.yml` ends with a blank line. The import errors follow from the empty metadata.",code:{lang:`bash`,code:`$ cd dev/ansible_collections/lab/platform
$ printf -- '---\\nrequires_ansible: ">=2.17.0"\\n' > meta/runtime.yml
$ sed -i '$ d' galaxy.yml
$ ansible-test sanity --venv --python 3.12 > /dev/null 2>&1 && echo 'all sanity tests passed'
all sanity tests passed`}},{title:`Add a unit test`,code:[{lang:`python`,file:`dev/ansible_collections/lab/platform/tests/unit/plugins/filter/test_lab_filters.py`,code:`from __future__ import annotations

import pytest

from ansible.errors import AnsibleFilterError
from ansible_collections.lab.platform.plugins.filter.lab_filters import merge_by


def test_right_updates_left():
    left = [{"name": "bob", "shell": "/bin/bash"}]
    right = [{"name": "bob", "shell": "/bin/zsh"}]
    assert merge_by(left, right, "name") == [{"name": "bob", "shell": "/bin/zsh"}]


def test_new_items_are_added():
    assert merge_by([{"name": "a"}], [{"name": "b"}], "name") == [{"name": "a"}, {"name": "b"}]


def test_rejects_non_lists():
    with pytest.raises(AnsibleFilterError):
        merge_by({"name": "a"}, [], "name")`},{lang:`bash`,code:`$ cd dev/ansible_collections/lab/platform
$ ansible-test units --venv --python 3.12 2>&1 | grep -E 'passed|failed'
============================== 3 passed in 1.40s ===============================`}]},{title:`Build and install 1.1.0`,text:"Set the version, keep test output out of the package, build into `src/`, and install over 1.0.0.",code:{lang:`bash`,code:`$ cd dev/ansible_collections/lab/platform
$ sed -i -e 's/^version: 1.0.0/version: 1.1.0/' -e "s|^build_ignore: \\[\\]|build_ignore: ['tests/output']|" galaxy.yml
$ ansible-galaxy collection build --output-path ~/lab/src
Created collection for lab.platform at /home/ansible/lab/src/lab-platform-1.1.0.tar.gz
$ cd ~/lab && ansible-galaxy collection install src/lab-platform-1.1.0.tar.gz -p collections --force
...
lab.platform:1.1.0 was installed successfully
$ ansible-galaxy collection list lab.platform -p collections
# /home/ansible/lab/collections/ansible_collections
Collection   Version
------------ -------
lab.platform 1.1.0`}},{title:`Use the collection content by name`,text:`Remove the local copies so that only the collection provides them, and call everything by its full name.`,code:[{lang:`bash`,code:`$ rm -r library filter_plugins lookup_plugins`},{lang:`yaml`,file:`collection-content.yml`,code:`---
- name: Use modules and plugins from lab.platform
  hosts: node2
  become: true
  gather_facts: false
  tasks:
    - name: Set a key with the collection module
      lab.platform.json_setting:
        path: /etc/lab-app/settings.json
        key: release
        value: "{{ lookup('lab.platform.dotenv', 'app.env', key='DB_NAME') }}"

    - name: Merge lists with the collection filter
      ansible.builtin.debug:
        msg: "{{ [{'name': 'a', 'v': 1}] | lab.platform.merge_by([{'name': 'a', 'v': 2}], 'name') }}"`},{lang:`bash`,code:`$ ansible-playbook collection-content.yml
TASK [Set a key with the collection module] ************************************
changed: [node2]

TASK [Merge lists with the collection filter] **********************************
ok: [node2] =>
    msg:
    -   name: a
        v: 2
$ ansible-doc lab.platform.json_setting | head -1
> MODULE lab.platform.json_setting (/home/ansible/lab/collections/ansible_collections/lab/platform/plugins/modules/json_setting.py)`}]}],verify:{text:"The first sanity run reports issues in `import`, `runtime-metadata` and `yamllint`; after the two fixes every test passes. The unit tests report `3 passed`. `ansible-galaxy collection list` shows lab.platform 1.1.0, and the playbook sets `release` to `shop` with `lab.platform.json_setting` and merges the lists with `lab.platform.merge_by` to `v: 2`."},solution:{text:"Once the module is in a collection, its short name `json_setting` no longer works without a `collections:` keyword; use the full name. `requires_ansible` is also what Ansible checks before loading the collection, and Galaxy and Automation Hub require it. Commit `dev/ansible_collections/lab/platform` as the new source of the collection and remove `src/lab/platform`, so there is one source."},challenge:"Add `tests/sanity/ignore-2.21.txt` only if you must silence a finding you cannot fix, and write the reason next to it. Then add a `changelogs/fragments/` entry and look at what `ansible-test sanity --test changelog` expects."},takeaways:[`ansible-test needs the collection at ansible_collections/<namespace>/<name>`,`Sanity tests check documentation, metadata and code; unit tests use pytest`,`Bump the version, build with ansible-galaxy and install like any collection`]}]};export{e as default};