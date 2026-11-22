var e={id:`low-data`,track:`low`,order:6,title:`Inventory and data at scale`,icon:`Database`,hue:200,blurb:`Build inventory from several sources and from facts, reshape data with filters instead of loops and shell, and make large runs fast: forks, strategies, background tasks, fact caching and task profiling.`,lessons:[{id:`l-dynamic-inventory`,title:`Dynamic and constructed inventory`,duration:`25 min`,summary:`A static file lists hosts by hand. In real estates the hosts already live somewhere: a cloud API, a virtualisation platform, a CMDB. Inventory plugins read those sources, and the constructed plugin builds groups and variables from what is known about each host, including cached facts. Several sources in one directory become one inventory.`,prereqs:[`l-inventory`,`l-variables-facts`],objectives:[`Combine several inventory sources in one directory`,`Build groups and variables with the constructed plugin`,`Keep facts between runs with a fact cache`,`Read the configuration of a cloud inventory plugin`],docs:[{label:`Working with dynamic inventory`,url:`https://docs.ansible.com/ansible/latest/inventory_guide/intro_dynamic_inventory.html`},{label:`constructed inventory plugin`,url:`https://docs.ansible.com/ansible/latest/collections/ansible/builtin/constructed_inventory.html`}],blocks:[{diagram:`flowchart LR
  A["hosts.ini<br/>static hosts and groups"] --> M["Inventory<br/>(one directory)"]
  B["Cloud or CMDB plugin<br/>for example aws_ec2"] --> M
  F[("Fact cache<br/>.facts/")] --> C["constructed<br/>keyed_groups, groups, compose"]
  M --> C
  C --> I["Final inventory:<br/>hosts, groups, variables"]`,title:`Sources are read in name order; constructed runs last and adds to what is there`},{table:{head:[`Option`,`What it does`,`Example`],rows:[["`compose`",`Sets a variable on every host from an expression`,'`os_label: ansible_distribution ~ " " ~ ansible_distribution_version`'],["`keyed_groups`",`One group per value of an expression, named prefix_value`,"Groups `el_9`, `port_8000`"],["`groups`",`A group for every host where a condition is true`,`\`web_and_staging: "'web' in group_names and 'staging' in group_names"\``],["`strict`","With `false`, an expression that fails (for example, facts not cached yet) is skipped instead of being an error","`strict: false`"],["`use_vars_plugins`","Also make `group_vars` and `host_vars` available to the expressions","`use_vars_plugins: true`"]]}},{p:"An inventory directory is read in alphabetical order of file names, and files that are not valid inventory (such as `group_vars/`) are ignored. Name the constructed file so that it sorts after the sources it builds on."},{h:`A cloud source`},{p:"Cloud and platform collections ship inventory plugins with the same constructed options. This one reads EC2 instances; it needs the `amazon.aws` collection, the boto3 library and AWS credentials, and its file name must end in `aws_ec2.yml`. It is shown as an example only: the lab has no cloud account."},{code:`# inventory/prod.aws_ec2.yml
plugin: amazon.aws.aws_ec2
regions:
  - eu-west-1
filters:
  tag:Environment: prod          # only production instances
hostnames:
  - private-ip-address
keyed_groups:
  - key: ec2_tags.Role           # role_web, role_db ...
    prefix: role
  - key: placement.region
    prefix: aws_region
compose:
  ansible_host: private_ip_address`,lang:`yaml`,title:`Example only: EC2 instances as inventory`},{h:`Fact caching`},{p:"By default facts live only for one run. A fact cache plugin stores them, so later runs, ad-hoc commands and the constructed plugin can use them. `jsonfile` writes one file per host; `redis` and others share a cache between control nodes. With `gathering = smart`, plays skip fact gathering for hosts whose facts are still in the cache."},{callout:"Cached facts can be stale. Set `fact_caching_timeout` to how old facts may be for your decisions, and gather again before anything that depends on current state, such as free disk space.",tone:`warn`}],lab:{title:`Groups from facts and variables`,goal:`Turn the inventory into a directory of sources, enable a fact cache, and let the constructed plugin build groups from distribution versions, ports and existing groups.`,duration:`20 min`,steps:[{title:`Point Ansible at the whole directory and enable the cache`,text:"Edit `ansible.cfg`: the inventory becomes the `inventory/` directory, and facts are cached as JSON files in `.facts/` for two hours.",code:{lang:`bash`,code:`$ sed -i 's|^inventory = ./inventory/hosts.ini|inventory = ./inventory|' ansible.cfg
$ sed -i '/^\\[defaults\\]/a fact_caching = ansible.builtin.jsonfile\\nfact_caching_connection = ./.facts\\nfact_caching_timeout = 7200' ansible.cfg
$ ansible-config dump --only-changed | grep -E 'CACHE_PLUGIN|DEFAULT_HOST_LIST'
CACHE_PLUGIN(/home/ansible/lab/ansible.cfg) = ansible.builtin.jsonfile
CACHE_PLUGIN_CONNECTION(/home/ansible/lab/ansible.cfg) = ./.facts
CACHE_PLUGIN_TIMEOUT(/home/ansible/lab/ansible.cfg) = 7200
DEFAULT_HOST_LIST(/home/ansible/lab/ansible.cfg) = ['/home/ansible/lab/inventory']`}},{title:`Add a constructed source`,code:{lang:`yaml`,file:`inventory/zz-constructed.yml`,code:`---
# Named zz- so it is read after hosts.ini: it builds on hosts and groups that already exist.
plugin: ansible.builtin.constructed
strict: false            # skip expressions that cannot be evaluated yet (no cached facts)
use_vars_plugins: true   # let expressions see group_vars and host_vars

compose:
  os_label: ansible_distribution ~ " " ~ ansible_distribution_version

keyed_groups:
  - key: ansible_distribution_major_version
    prefix: el
  - key: http_port | default(80) | string
    prefix: port

groups:
  web_and_staging: "'web' in group_names and 'staging' in group_names"`}},{title:`Look at the inventory before any facts exist`,text:"The groups from variables are there; `el_*` is not, because no facts are cached yet.",code:{lang:`bash`,code:`$ ansible-inventory --graph
@all:
  |--@ungrouped:
  |--@app:
  |  |--@lb:
  |  |  |--node1
  |  |--@web:
  |  |  |--node2
  |  |  |--node3
  |  |--@db:
  |  |  |--node4
  |--@staging:
  |  |--node2
  |  |--node4
  |--@port_80:
  |  |--node1
  |  |--node4
  |--@web_and_staging:
  |  |--node2
  |--@port_8000:
  |  |--node2
  |--@port_9000:
  |  |--node3`}},{title:`Cache facts and look again`,code:{lang:`bash`,code:`$ ansible app -m ansible.builtin.setup -a gather_subset=min > /dev/null
$ ls .facts
s1_node1
s1_node2
s1_node3
s1_node4
$ ansible-inventory --graph el_9
@el_9:
  |--node1
  |--node2
  |--node3
  |--node4
$ ansible-inventory --host node3 | grep -E '"(os_label|http_port)"'
    "http_port": 9000,
    "os_label": "Rocky 9.8"`}},{title:`Target hosts by constructed groups`,code:{lang:`bash`,code:`$ ansible 'el_9:&port_80' --list-hosts
  hosts (2):
    node1
    node4
$ ansible web_and_staging -m ansible.builtin.debug -a var=os_label
node2 | SUCCESS =>
    os_label: Rocky 9.8`}}],verify:{text:"`ansible-inventory --graph` shows `port_80` (node1, node4), `port_8000` (node2), `port_9000` (node3) and `web_and_staging` (node2); after the facts are cached it also shows `el_9` with all four nodes, and node3 has `os_label` set from its cached facts (`Rocky 9.8` when this course was written)."},solution:{text:"The cache file names start with a schema prefix that ansible-core adds (`s1_node1` here), so do not read or write these files by hand. Without `use_vars_plugins: true` the `port_*` groups would all be `port_80`, because `http_port` comes from `group_vars` and `host_vars`. Without `strict: false` the first `ansible-inventory` would fail on the missing facts."},challenge:"Add a `groups:` entry `small_hosts` for hosts with less than 2048 MB of memory (`ansible_memtotal_mb`), and a `compose` variable that sets `ansible_python_interpreter` to `/usr/bin/python3` for every host in `el_9`. Gather facts with `gather_subset=hardware` first."},takeaways:[`An inventory directory combines sources in name order`,`constructed builds groups and variables from facts, variables and existing groups`,`A fact cache keeps facts between runs; mind its timeout`]},{id:`l-data-transformation`,title:`Transforming data with filters`,duration:`25 min`,summary:`Most automation turns one shape of data into another: a list of applications into firewall rules, defaults plus overrides into a configuration, a list into a lookup table. Jinja2 filters do this declaratively, without shell commands or long loops. Validate the input first with assert, so a bad value fails early with a clear message.`,prereqs:[`l-conditionals-loops`,`l-templates`],objectives:[`Select, map and sum values from lists of dictionaries`,`Convert between lists and dictionaries and merge dictionaries deeply`,`Validate input data with assert before using it`],docs:[{label:`Manipulating data`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/complex_data_manipulation.html`},{label:`Using filters to manipulate data`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_filters.html`}],blocks:[{table:{head:[`Filter`,`Does`,`Example`],rows:[["`selectattr` / `rejectattr`",`Keep or drop list items by a test on an attribute`,"`apps | selectattr('env', 'eq', 'prod')`"],["`map(attribute=…)`",`Take one attribute from every item`,"`apps | map(attribute='name')`"],["`map('filter', …)`",`Apply a filter to every item`,"`ports | map('string')`"],["`sum`, `unique`, `length`, `min`, `max`",`Aggregate a list`,"`… | map(attribute='replicas') | sum`"],["`items2dict` / `dict2items`",`List of key-value items to a dictionary, and back`,"`apps | items2dict(key_name='name', value_name='port')`"],["`combine`","Merge dictionaries; `recursive=true` merges nested ones","`defaults | combine(overrides, recursive=true)`"],["`community.general.json_query`",`JMESPath queries on complex data`,"Needs the `jmespath` library on the control node"]]}},{p:"Filters run on the control node. Add `| list` after `map`, `select` and similar filters when you need a real list: they return generators, which print oddly and cannot be indexed."},{callout:"Before writing a loop with `set_fact` that appends to a list item by item, look for a filter chain. It is shorter, faster and easier to test, and it does not need a task per item.",tone:`arch`}],lab:{title:`From application data to configuration`,goal:`Validate a list of applications, then derive names, totals, a port table, a merged configuration and firewall rule strings from it, all without shell commands.`,duration:`20 min`,steps:[{title:`Write the playbook`,code:{lang:`yaml`,file:`data.yml`,code:`---
- name: Transform data without writing Python
  hosts: localhost
  connection: local
  gather_facts: false
  vars:
    apps:
      - { name: shop, team: web, port: 8080, env: prod, replicas: 3 }
      - { name: search, team: web, port: 9200, env: prod, replicas: 2 }
      - { name: reports, team: data, port: 8443, env: test, replicas: 1 }
      - { name: billing, team: finance, port: 8081, env: prod, replicas: 2 }
    defaults: { tls: true, log_level: info, limits: { cpu: 1, memory: 512 } }
    overrides: { log_level: debug, limits: { memory: 1024 } }

  tasks:
    - name: Validate the input before using it
      ansible.builtin.assert:
        that:
          - apps | map(attribute='port') | unique | length == apps | length
          - apps | selectattr('replicas', 'lt', 1) | list | length == 0
        fail_msg: ports must be unique and every app needs at least one replica
        quiet: true

    - name: Production app names
      ansible.builtin.debug:
        msg: "{{ apps | selectattr('env', 'eq', 'prod') | map(attribute='name') | list }}"

    - name: Total replicas in production
      ansible.builtin.debug:
        msg: "{{ apps | selectattr('env', 'eq', 'prod') | map(attribute='replicas') | sum }}"

    - name: Build a port table (list to dictionary)
      ansible.builtin.set_fact:
        port_table: "{{ apps | items2dict(key_name='name', value_name='port') }}"

    - name: Loop over the table (dictionary to list)
      ansible.builtin.debug:
        msg: "{{ item.key }} listens on {{ item.value }}"
      loop: "{{ port_table | dict2items }}"
      loop_control:
        label: "{{ item.key }}"

    - name: Deep merge of defaults and overrides
      ansible.builtin.debug:
        msg: "{{ defaults | combine(overrides, recursive=true) }}"

    - name: One firewall rule string per app
      ansible.builtin.debug:
        msg: "{{ apps | map(attribute='port') | map('string') | map('regex_replace', '^', 'allow tcp/') | list }}"`}},{title:`Run it`,code:{lang:`bash`,code:`$ ansible-playbook data.yml`}},{title:`Feed it bad data`,text:"Extra variables have the highest precedence, so `-e` replaces the list from the playbook. Two apps share port 8080.",code:[{lang:`yaml`,file:`bad-apps.yml`,code:`---
apps:
  - { name: shop, team: web, port: 8080, env: prod, replicas: 3 }
  - { name: shop-canary, team: web, port: 8080, env: prod, replicas: 1 }`},{lang:`bash`,code:`$ ansible-playbook data.yml -e @bad-apps.yml
TASK [Validate the input before using it] **************************************
[ERROR]: Task failed: Action failed: ports must be unique and every app needs at least one replica
...
fatal: [localhost]: FAILED! =>
    assertion: apps | map(attribute='port') | unique | length == apps | length
    changed: false
    evaluated_to: false
    msg: ports must be unique and every app needs at least one replica`}]}],verify:{text:"The good run prints `[shop, search, billing]`, a total of `7`, one line per app from the port table, the merged dictionary with `log_level: debug`, `limits.cpu: 1` and `limits.memory: 1024`, and four `allow tcp/<port>` strings. The run with `bad-apps.yml` stops at the assert with the `fail_msg` and runs no other task."},solution:{text:"`combine` without `recursive=true` would replace the whole `limits` dictionary and lose `cpu: 1`. In the rule strings, `map('string')` is needed because `regex_replace` works on strings and the ports are integers. `loop_control.label` keeps the loop output short: only the key is printed for each item instead of the whole item."},challenge:"Add a task that prints, for each team, the list of its app names (hint: `groupby('team')` returns pairs of a team and its apps). Then add an assert that every `env` is either `prod` or `test`."},takeaways:[`Filter chains select, map, aggregate and reshape data declaratively`,`items2dict, dict2items and combine convert and merge structures`,`Validate input with assert so bad data fails early and clearly`]},{id:`l-performance`,title:`Performance at scale`,duration:`25 min`,summary:`A playbook that takes a minute on four hosts can take hours on four thousand. Measure first with a profiling callback, then use the levers Ansible gives you: more forks, a strategy that does not wait for the slowest host, background tasks for long operations, less fact gathering, and SSH pipelining and connection reuse.`,prereqs:[`l-rolling`,`l-dynamic-inventory`],objectives:[`Measure where time goes with profile_tasks`,`Choose forks and a strategy (linear, free, host_pinned)`,`Run long tasks in the background with async and poll`,`Reduce fact gathering and connection overhead`],docs:[{label:`Controlling playbook execution: strategies and more`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_strategies.html`},{label:`Asynchronous actions and polling`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_async.html`}],blocks:[{table:{head:[`Lever`,`Effect`,`Where`],rows:[["`forks`",`How many hosts Ansible works on in parallel (default 5)`,"`ansible.cfg`, `-f`"],["`strategy: linear`",`Default: every host finishes a task before any host starts the next`,`Play`],["`strategy: free`",`Each host runs through the tasks as fast as it can`,`Play`],["`strategy: host_pinned`",`Like free, but a fork stays with one host until it is done`,`Play`],["`async` + `poll`","Run a task in the background; `poll: 0` moves on, `async_status` collects the result later",`Task`],["`gather_facts: false`, `gather_subset`",`Gather no facts, or only what you need`,`Play`],["Fact cache + `gathering = smart`",`Reuse cached facts instead of gathering every run`,"`ansible.cfg`"],["`pipelining`, `ControlPersist`",`Fewer SSH operations per task, reused connections`,"`ansible.cfg` (both already on in the lab)"]]}},{table:{head:[`Strategy`,`node1 (slow on step 1)`,`node2 (slow on step 2)`,`Play takes`],rows:[[`linear`,`Step 1: 4 s, step 2 starts when every host finished step 1`,`Step 1: 1 s, waits 3 s, step 2: 4 s`,`4 + 4 = 8 s`],[`free`,`Step 1: 4 s, step 2: 1 s`,`Step 1: 1 s, step 2: 4 s`,`max(4 + 1, 1 + 4) = 5 s`]]}},{callout:"`free` changes the order of output and makes plays harder to reason about when hosts depend on each other (for example a load balancer and its back ends). Use it for independent hosts; keep `linear` with `serial` for rolling changes.",tone:`warn`}],lab:{title:`Measure and speed up`,goal:`See the effect of forks and strategies with timed runs, run a long task in the background, and profile a playbook.`,duration:`20 min`,steps:[{title:`Forks`,text:"The lab sets `forks = 10`. With one fork, four hosts run one after the other.",code:{lang:`bash`,code:`$ time ansible app -a 'sleep 2' -f 1 > /dev/null
real	0m9.178s
$ time ansible app -a 'sleep 2' > /dev/null
real	0m2.681s`}},{title:`Strategies`,code:[{lang:`yaml`,file:`strategy.yml`,code:`---
- name: Linear versus free strategy
  hosts: app
  gather_facts: false
  strategy: "{{ play_strategy | default('linear') }}"
  tasks:
    - name: Step 1 (node1 is slow here)
      ansible.builtin.command: "sleep {{ 4 if inventory_hostname == 'node1' else 1 }}"
      changed_when: false

    - name: Step 2 (node2 is slow here)
      ansible.builtin.command: "sleep {{ 4 if inventory_hostname == 'node2' else 1 }}"
      changed_when: false`},{lang:`bash`,code:`$ time ansible-playbook strategy.yml > /dev/null
real	0m8.817s
$ time ansible-playbook strategy.yml -e play_strategy=free > /dev/null
real	0m5.852s`}]},{title:`A background task`,code:[{lang:`yaml`,file:`async.yml`,code:`---
- name: Fire and forget, then collect
  hosts: web
  gather_facts: false
  tasks:
    - name: Start a long job in the background
      ansible.builtin.command: sleep 6
      async: 60     # allow up to 60 seconds
      poll: 0       # do not wait
      register: long_job
      changed_when: false

    - name: Do other work meanwhile
      ansible.builtin.command: hostname
      changed_when: false

    - name: Wait for the background job
      ansible.builtin.async_status:
        jid: "{{ long_job.ansible_job_id }}"
      register: result
      until: result.finished
      retries: 20
      delay: 1`},{lang:`bash`,code:`$ ANSIBLE_CALLBACKS_ENABLED=ansible.posix.profile_tasks ansible-playbook async.yml | tail -5
Saturday 31 October 2026  19:05:37 +0000 (0:00:06.097)       0:00:06.613 ******
===============================================================================
Wait for the background job --------------------------------------------- 6.10s
Start a long job in the background -------------------------------------- 0.37s
Do other work meanwhile ------------------------------------------------- 0.14s`}]}],verify:{text:`With one fork the four 2-second commands run one after another (about 9 seconds); with ten forks they run together (under 3). The linear run takes about 9 seconds (4 + 4 plus overhead), the free run about 6 (each host 4 + 1 plus overhead). Your times differ slightly. In the async play, "Do other work meanwhile" finishes while the sleep is still running, and the profile shows most of the time in "Wait for the background job".`},solution:{text:'`profile_tasks` comes from the `ansible.posix` collection and is enabled per run with `ANSIBLE_CALLBACKS_ENABLED`, or permanently with `callbacks_enabled` in `ansible.cfg`. The "FAILED - RETRYING" lines of the `until` loop are normal: each one is a poll that found the job still running. For many hosts, start the async task on all of them first, then poll, so the waiting happens in parallel.'},challenge:"Run `strategy.yml` with `-e play_strategy=host_pinned -f 2` and compare the order of the output with `free -f 2`. Then add `gather_facts: true` with `gather_subset: [min]` to the play and use `profile_tasks` to see what fact gathering costs."},takeaways:[`Measure with profile_tasks before tuning`,`Forks set parallelism; free and host_pinned stop slow hosts from holding others back`,`async with poll 0 and async_status runs long work in the background`]}]};export{e as default};