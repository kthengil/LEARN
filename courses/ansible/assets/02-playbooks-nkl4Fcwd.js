var e={id:`low-playbooks`,track:`low`,order:2,title:`Playbooks`,icon:`FileCode2`,hue:195,blurb:`Write, run and debug playbooks. Variables and facts, loops and conditionals, handlers, and Jinja2 templates.`,lessons:[{id:`l-first-playbook`,title:`Your first playbook`,duration:`30 min`,summary:`Playbooks are YAML files of plays; each play maps a group of hosts to an ordered list of tasks. Learn the structure, run it safely with check and diff mode, and read the output.`,prereqs:[`l-adhoc`],objectives:[`Explain the playbook → play → task → module hierarchy`,`Write valid YAML for playbooks and avoid the common indentation and quoting traps`,"Run a playbook with `--syntax-check`, `--check`, `--diff`, `--limit`, and `-v`",`Read the PLAY RECAP and explain idempotence from it`],docs:[{label:`Intro to playbooks`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html`}],blocks:[{h:`Structure`},{diagram:`flowchart LR
  PB["Playbook<br/>site.yml"] --> P1["Play 1<br/>hosts: web"]
  PB --> P2["Play 2<br/>hosts: db"]
  P1 --> T1["Task: install nginx<br/>module: dnf"]
  P1 --> T2["Task: deploy page<br/>module: copy"]
  P1 --> T3["Task: start service<br/>module: service"]
  P1 --> H["Handlers"]
  P2 --> T4["Task ..."]`,title:`Playbook hierarchy`},{concepts:[{name:`Playbook`,text:"A YAML file containing a list of plays. Run it with `ansible-playbook`. Plays run in order, top to bottom."},{name:`Play`,text:"Targets hosts (`hosts:` pattern) and sets play-level options such as `become`, `vars`, and `gather_facts`. Contains tasks, handlers, and roles."},{name:`Task`,text:"One call to one module with arguments, plus optional keywords such as `when`, `loop`, `notify`, `register`, `tags`. Always give it a `name`."},{name:`Module`,text:"The unit of work. Use the fully qualified collection name (FQCN), for example `ansible.builtin.dnf`, so it is clear which collection provides it."}]},{h:`Execution order`},{p:"By default (`strategy: linear`) Ansible runs **task 1 on all hosts in parallel** (up to `forks`), waits for every host to finish it, then moves to task 2. If a task fails on a host, that host is removed from the rest of the play; the other hosts carry on. Handlers run at the end of the play."},{diagram:`sequenceDiagram
  participant C as Control node
  participant A as node2
  participant B as node3
  C->>A: Gather facts
  C->>B: Gather facts
  C->>A: Task 1 install nginx
  C->>B: Task 1 install nginx
  Note over C: Wait for all hosts
  C->>A: Task 2 deploy page
  C->>B: Task 2 deploy page
  Note over C: Wait for all hosts
  C->>A: Task 3 start nginx
  C->>B: Task 3 start nginx
  C->>C: Run notified handlers, then PLAY RECAP`,title:`Linear strategy: task by task across hosts`},{h:`A complete playbook`},{code:`---
- name: Configure web servers
  hosts: web
  become: true

  tasks:
    - name: Install nginx
      ansible.builtin.dnf:
        name: nginx
        state: present

    - name: Deploy the home page
      ansible.builtin.copy:
        content: "Hello from {{ inventory_hostname }}\\n"
        dest: /usr/share/nginx/html/index.html
        mode: "0644"

    - name: Start and enable nginx
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true`,lang:`yaml`,file:`web.yml`},{h:`YAML traps`},{list:[`Indent with **spaces only**, two per level. A tab is a syntax error.`,'A value that **starts** with `{{` must be quoted: `msg: "{{ var }}"`. Unquoted, YAML reads it as a dictionary.','Quote file modes: `mode: "0644"`. Unquoted `0644` is read as an octal number and can surprise you.','`yes`/`no`/`on`/`off` are booleans in YAML 1.1. Use `true`/`false`, and quote strings like `"no"` when you mean the text.',"Use `|` to keep line breaks in a multi-line string and `>` to fold lines into one."]},{h:`Running safely`},{code:`$ ansible-playbook web.yml --syntax-check     # parse only
$ ansible-playbook web.yml --list-hosts       # which hosts would run
$ ansible-playbook web.yml --list-tasks       # which tasks would run
$ ansible-playbook web.yml --check --diff     # dry run: report what would change, show file diffs
$ ansible-playbook web.yml --limit node2      # one host only
$ ansible-playbook web.yml --step             # confirm each task interactively
$ ansible-playbook web.yml --start-at-task "Start and enable nginx"
$ ansible-playbook web.yml -vvv               # verbose: SSH commands and module args`,lang:`bash`},{callout:"Check mode is a simulation. Modules that support it predict changes; `command` and `shell` are skipped. A task that depends on a package installed earlier in the same run can fail in check mode because the package is not really there yet.",tone:`warn`},{h:`Reading the recap`},{code:`PLAY RECAP *********************************************************************
node2   : ok=4    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
node3   : ok=4    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0`,lang:`text`},{p:"`ok` counts every task that succeeded, changed or not. `changed` counts tasks that modified the host. A well-written playbook run twice in a row shows `changed=0` the second time. That is **idempotence**, and it is the first quality check for any playbook."}],lab:{title:`Deploy nginx and test it from the control node`,goal:`Write a two-play playbook: the first configures the web group, the second runs on the control node itself and requests both web servers.`,duration:`15 min`,steps:[{title:`Create the playbook`,text:"On **controller**, in `~/lab`, create `web.yml` (with `nano web.yml` or `vim web.yml`). The second play uses `hosts: localhost` with `connection: local`, so it runs on the controller itself without SSH, and reaches the web servers by name.",code:{lang:`yaml`,file:`web.yml`,code:`---
- name: Configure web servers
  hosts: web
  become: true

  tasks:
    - name: Install nginx
      ansible.builtin.dnf:
        name: nginx
        state: present

    - name: Deploy the home page
      ansible.builtin.copy:
        content: "Hello from {{ inventory_hostname }}\\n"
        dest: /usr/share/nginx/html/index.html
        mode: "0644"

    - name: Start and enable nginx
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true

- name: Check the web tier from the control node
  hosts: localhost
  connection: local
  gather_facts: false

  tasks:
    - name: Request each web server
      ansible.builtin.uri:
        url: "http://{{ item }}/"
        return_content: true
      loop: "{{ groups['web'] }}"
      register: pages

    - name: Show what each server returned
      ansible.builtin.debug:
        msg: "{{ pages.results | map(attribute='content') | map('trim') | list }}"`}},{title:`Check, then dry-run`,text:"On fresh nodes the dry run stops at **Start and enable nginx** with `Could not find the requested service nginx`. That is expected: in check mode nothing is installed, so the nginx service does not exist yet. Tasks that depend on an earlier change cannot be fully predicted, which is the main limit of check mode. After the real run, the same dry run passes and reports no changes.",code:{lang:`bash`,code:`$ ansible-playbook web.yml --syntax-check
$ ansible-playbook web.yml --check --diff`}},{title:`Run it for real`,code:{lang:`bash`,code:`$ ansible-playbook web.yml
...
TASK [Show what each server returned] ******************************************
ok: [localhost] =>
    msg:
    - Hello from node2
    - Hello from node3`}},{title:`Run it again`,text:"Look at the recap: every web task is now `ok` and `changed=0`.",code:{lang:`bash`,code:`$ ansible-playbook web.yml | tail -4`}}],verify:{text:"Both pages open in your browser at http://localhost:28201/web/node2/ and http://localhost:28201/web/node3/ (or use the links in the lab page), and a second run reports `changed=0` for node2 and node3.",code:{lang:`bash`,title:`On controller`,code:`$ curl -s http://node2/ http://node3/
Hello from node2
Hello from node3`}},challenge:"Change the page text, then run with `--check --diff` first to preview the change, and only then apply it. Next, break the YAML on purpose (use a tab) and read the error from `--syntax-check`."},takeaways:[`Playbook → plays → tasks → modules. Name every task and use FQCNs.`,`Linear strategy runs each task on all hosts before the next task; failed hosts drop out.`,"Always `--syntax-check` and `--check --diff` before touching production, and expect `changed=0` on the second run."]},{id:`l-variables-facts`,title:`Variables, facts and precedence`,duration:`35 min`,summary:"Where variables can be defined, which one wins, what facts and magic variables are, and how to capture task output with `register` and `set_fact`.",prereqs:[`l-first-playbook`],objectives:[`Define variables in plays, files, inventory, and on the command line`,`Apply the precedence rules to predict which value wins`,"Use facts (`ansible_facts`) and magic variables (`hostvars`, `groups`, `group_names`, `inventory_hostname`)","Capture results with `register` and derive values with `set_fact`"],docs:[{label:`Using variables`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_variables.html`},{label:`Discovering facts`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_vars_facts.html`}],blocks:[{h:`Where variables come from`},{code:`- name: Variables at play level
  hosts: web
  vars:
    app_port: 8080
  vars_files:
    - vars/common.yml
  tasks:
    - name: Use them
      ansible.builtin.debug:
        msg: "Port {{ app_port }}, region {{ region }}"`,lang:`yaml`},{p:"You can also set variables in inventory (`group_vars/`, `host_vars/`), role `defaults/` and `vars/`, task `vars:`, `include_vars`, `set_fact`, `register`, and on the command line with `-e`. That is a lot of places, so teams agree on a small number of them (see the High-level lesson on inventory design)."},{h:`Precedence, simplified`},{p:`Ansible has 22 precedence levels. In practice you need the order of the ones you use. Higher in this list wins:`},{diagram:`flowchart TD
  E["-e extra vars (always win)"] --> SF["set_fact / registered vars"]
  SF --> TV["Task vars, block vars"]
  TV --> RV["Role vars/ and include_vars"]
  RV --> PV["Play vars, vars_files, vars_prompt"]
  PV --> HF["Host facts"]
  HF --> HV["Inventory host_vars"]
  HV --> GV["Inventory group_vars: child group, then parent, then all"]
  GV --> RD["Role defaults/ (always lose)"]`,title:`Variable precedence: top wins`},{callout:"Put tunable values in **role defaults** (lowest) so inventory can override them. Put values that must not be overridden in **role vars**. Use `-e` for one-off overrides only, because nothing can override it, not even a later `set_fact`.",tone:`tip`},{h:`Facts`},{p:"At the start of each play, the `setup` module gathers **facts**: OS, network, hardware, mounts and more. They are available under `ansible_facts`. Turn gathering off with `gather_facts: false` when you do not need them, which speeds up plays."},{code:`$ ansible node2 -m setup -a 'filter=ansible_default_ipv4'
$ ansible node2 -m setup -a 'gather_subset=!all,!min,distribution'`,lang:`bash`},{code:`{{ ansible_facts['distribution'] }}          # Rocky
{{ ansible_facts['default_ipv4']['address'] }}
{{ ansible_facts['memtotal_mb'] }}
{{ ansible_facts['os_family'] }}             # RedHat, Debian, ...`,lang:`jinja`},{callout:"Custom facts: drop a `.fact` file (INI or JSON, or an executable that prints JSON) into `/etc/ansible/facts.d/` on a node, and it appears under `ansible_facts.ansible_local`.",tone:`note`},{h:`Magic variables`},{table:{head:[`Variable`,`Contains`],rows:[["`inventory_hostname`",`The host’s name in the inventory (node2)`],["`group_names`",`Groups the current host belongs to`],["`groups`","Every group and its hosts: `groups['web']`"],["`hostvars`","Variables and facts of any host: `hostvars['node1']['ansible_facts']`"],["`ansible_play_hosts`",`Hosts still active in the current play`],["`playbook_dir`, `role_path`",`Paths, handy for lookups`]]}},{h:`register and set_fact`},{code:`- name: Count running processes
  ansible.builtin.command: ps -e --no-headers
  register: ps_out
  changed_when: false          # reading data never changes the host

- name: Store a derived value
  ansible.builtin.set_fact:
    process_count: "{{ ps_out.stdout_lines | length }}"`,lang:`yaml`},{p:"A registered variable holds the module’s full result: `rc`, `stdout`, `stdout_lines`, `stderr`, `changed`, `failed` and any module-specific keys. Print it with `debug: var=ps_out` to see the shape before you use it."}],lab:{title:`Predict, then prove, variable values`,goal:`Combine play vars, extra vars, facts, registered output and hostvars in one playbook.`,duration:`15 min`,steps:[{title:`Write the playbook`,code:{lang:`yaml`,file:`facts.yml`,code:`---
- name: Explore variables and facts
  hosts: app
  vars:
    app_name: shop
    app_env: dev
    owner: "{{ app_name }}-team"

  tasks:
    - name: Show facts and variables together
      ansible.builtin.debug:
        msg: >-
          {{ inventory_hostname }} runs {{ ansible_facts['distribution'] }}
          {{ ansible_facts['distribution_version'] }} with
          {{ ansible_facts['memtotal_mb'] }} MB RAM. App {{ app_name }} ({{ app_env }}),
          owned by {{ owner }}. Groups: {{ group_names | join(', ') }}

    - name: Count running processes
      ansible.builtin.command: ps -e --no-headers
      register: ps_out
      changed_when: false

    - name: Store a derived value
      ansible.builtin.set_fact:
        process_count: "{{ ps_out.stdout_lines | length }}"

    - name: Report it
      ansible.builtin.debug:
        msg: "{{ inventory_hostname }} has {{ process_count }} processes"

    - name: Read another host's facts through hostvars
      ansible.builtin.debug:
        msg: "The load balancer is {{ hostvars[groups['lb'][0]]['ansible_facts']['hostname'] }}"
      run_once: true`}},{title:`Predict the output, then run`,text:"Before running, write down what `app_env` will print with and without `-e`.",code:{lang:`bash`,code:`$ ansible-playbook facts.yml
$ ansible-playbook facts.yml -e app_env=prod`}},{title:`Inspect a registered variable`,text:"Add this task after `Count running processes` to see everything a module returns.",code:{lang:`yaml`,code:`    - name: Dump the whole result
      ansible.builtin.debug:
        var: ps_out
      when: inventory_hostname == 'node1'`}}],verify:{text:"With `-e app_env=prod` every host prints `(prod)`; without it, `(dev)`. The web nodes report more processes than node1 and node4 because nginx is running there. The last task prints once: `The load balancer is node1`."},challenge:"Set `app_env: staging` in `inventory/group_vars/web.yml`. Run without `-e`: which wins, the play `vars` or `group_vars`? Check your answer against the precedence diagram.",solution:{text:"Play `vars` win over inventory `group_vars`, so every host still prints `dev`. To let inventory decide, remove `app_env` from the play and give it a default instead: `{{ app_env | default('dev') }}`."}},takeaways:["Few places, clear purpose: role defaults for tunables, inventory for environment differences, `-e` for one-offs.",`Facts describe the host; magic variables describe the inventory and the run.`,"`register` captures results; mark read-only commands `changed_when: false`."]},{id:`l-conditionals-loops`,title:`Conditionals and loops`,duration:`30 min`,summary:"Run tasks only when conditions hold with `when`, repeat tasks over lists and dictionaries with `loop`, and retry until a condition is met.",prereqs:[`l-variables-facts`],objectives:["Write `when` conditions using facts, variables, registered results and tests","Loop over lists, lists of dictionaries and dictionaries (`dict2items`)","Use `loop_control` for readable output and nested data","Retry a task with `until`, `retries` and `delay`"],docs:[{label:`Conditionals`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_conditionals.html`},{label:`Loops`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_loops.html`}],blocks:[{h:`when`},{p:"`when` takes a raw Jinja2 expression, without `{{ }}`. A list of conditions means **all** must be true. Ansible evaluates `when` per host, and per item inside a loop."},{code:`- name: Install the EPEL repository on Red Hat family 9.x only
  ansible.builtin.dnf:
    name: epel-release
  when:
    - ansible_facts['os_family'] == 'RedHat'
    - ansible_facts['distribution_major_version'] | int == 9

- name: Restart only if the config check said so
  ansible.builtin.service:
    name: app
    state: restarted
  when: config_check.rc != 0 or force_restart | default(false) | bool

- name: Only hosts in the web group
  ansible.builtin.debug:
    msg: web node
  when: "'web' in group_names"`,lang:`yaml`},{table:{head:[`Test`,`Example`],rows:[[`defined / undefined`,"`when: db_password is defined`"],[`succeeded / failed / changed / skipped`,"`when: result is failed`"],[`match / search / regex`,"`when: hostname is match('web-\\d+')`"],[`version`,"`when: ansible_facts.python.version.major is version(3, '>=')`"],[`in`,"`when: item.name in allowed_users`"]]}},{callout:'Variables from inventory and `-e` are often strings. `"false"` is a non-empty string, so it is truthy. Use the `| bool` filter whenever a boolean might arrive as text.',tone:`warn`},{h:`loop`},{code:`- name: Simple list
  ansible.builtin.dnf:
    name: "{{ item }}"
  loop: [git, tar, curl]          # better: pass the list in one call, name: [git, tar, curl]

- name: List of dictionaries
  ansible.builtin.user:
    name: "{{ item.name }}"
    groups: "{{ item.groups }}"
  loop: "{{ users }}"
  loop_control:
    label: "{{ item.name }}"      # print only the name, not the whole dict

- name: Loop over a dictionary
  ansible.builtin.debug:
    msg: "{{ item.key }} listens on {{ item.value }}"
  loop: "{{ ports | dict2items }}"   # ports: {http: 80, https: 443}

- name: Nested data with subelements
  ansible.builtin.authorized_key:
    user: "{{ item.0.name }}"
    key: "{{ item.1 }}"
  loop: "{{ users | subelements('ssh_keys') }}"`,lang:`yaml`},{callout:"Many modules accept a list directly (`dnf`, `package`, `apt`). One call with a list is much faster than a loop that calls the module once per item.",tone:`tip`},{h:`Retry until`},{code:`- name: Wait for the app to report healthy
  ansible.builtin.uri:
    url: http://localhost:8080/health
  register: health
  until: health.status == 200
  retries: 10
  delay: 3`,lang:`yaml`},{diagram:`flowchart LR
  T["Run task"] --> C{"until condition true?"}
  C -->|yes| OK(["ok"])
  C -->|no| R{"retries left?"}
  R -->|yes| W["wait delay seconds"] --> T
  R -->|no| F(["failed"])`,title:`until / retries / delay`}],lab:{title:`Data-driven users and packages`,goal:`Drive users and per-tier packages from data structures, with conditions on facts and a retry loop.`,duration:`15 min`,steps:[{title:`Write the playbook`,text:`The package task loops over only the groups that both the host belongs to and that have packages defined.`,code:{lang:`yaml`,file:`users.yml`,code:`---
- name: Manage users and packages with loops and conditions
  hosts: app
  become: true
  vars:
    users:
      - { name: alice, groups: [wheel], shell: /bin/bash }
      - { name: bob, groups: [], shell: /bin/bash }
      - { name: carol, groups: [wheel], shell: /bin/bash, state: absent }
    tier_packages:
      web: [nginx, tar]
      db: [postgresql-server]
      lb: [haproxy]

  tasks:
    - name: Manage user accounts
      ansible.builtin.user:
        name: "{{ item.name }}"
        groups: "{{ item.groups }}"
        shell: "{{ item.shell }}"
        state: "{{ item.state | default('present') }}"
        remove: "{{ (item.state | default('present')) == 'absent' }}"
      loop: "{{ users }}"
      loop_control:
        label: "{{ item.name }}"

    - name: Install packages for each group the host is in
      ansible.builtin.dnf:
        name: "{{ tier_packages[item] }}"
        state: present
      loop: "{{ group_names | select('in', tier_packages) | list }}"

    - name: Only on Red Hat family hosts with more than 512 MB RAM
      ansible.builtin.debug:
        msg: "{{ inventory_hostname }} qualifies"
      when:
        - ansible_facts['os_family'] == 'RedHat'
        - ansible_facts['memtotal_mb'] > 512

    - name: Wait until a file appears (retry loop)
      ansible.builtin.stat:
        path: /etc/passwd
      register: st
      until: st.stat.exists
      retries: 5
      delay: 2`}},{title:`Run it twice`,code:{lang:`bash`,code:`$ ansible-playbook users.yml
$ ansible-playbook users.yml      # second run: changed=0`}},{title:`Change the data, not the code`,text:"Set `carol` to present and `bob` to `state: absent`, then rerun. Only those two users change.",code:{lang:`bash`,code:`$ ansible app -a 'id alice'
$ ansible app -a 'getent passwd bob carol'`}}],verify:{text:"node1 has haproxy, node2 and node3 have nginx and tar, node4 has postgresql-server. alice exists everywhere and is in `wheel`. The second run shows `changed=0`.",code:{lang:`bash`,code:`$ ansible app -m shell -a "rpm -q haproxy nginx postgresql-server | grep -v 'not installed'"`}},challenge:"Add an `ssh_keys` list to each user and install the keys with `ansible.posix.authorized_key` using `subelements`. You need the `ansible.posix` collection: `ansible-galaxy collection install ansible.posix`."},takeaways:["`when` uses bare expressions; a list of conditions is an AND. Cast with `| bool` and `| int`.","Drive loops from data so you change variables, not tasks. Use `loop_control.label` for readable output.",`Prefer passing lists to modules that accept them over looping.`]},{id:`l-handlers`,title:`Handlers and change notification`,duration:`20 min`,summary:`Handlers are tasks that run only when notified by a change, once, at the end of the play. Use them to reload or restart services after configuration changes.`,prereqs:[`l-first-playbook`],objectives:[`Notify handlers from tasks and explain when they run`,"Use `listen` to trigger several handlers with one topic","Run handlers early with `meta: flush_handlers`",`Know what happens to pending handlers when a task fails`],docs:[{label:`Handlers`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html`}],blocks:[{h:`How handlers work`},{diagram:`sequenceDiagram
  participant P as Play
  participant T1 as Task: config A
  participant T2 as Task: config B
  participant H as Handler: Reload nginx
  P->>T1: run
  T1-->>H: changed, so notify
  P->>T2: run
  T2-->>H: changed, so notify again
  Note over H: Queued once, not twice
  P->>H: End of play: run once
  Note over P,H: If neither task changed, the handler never runs`,title:`Notify, queue, run once`},{list:["A task notifies a handler by name (or by a `listen` topic) only when it reports **changed**.","Handlers run **once**, after all tasks in the play (or at each `flush_handlers`), in the order they are **defined**, not the order notified.","If a host fails later in the play, its pending handlers are **lost**. Use `--force-handlers` or `force_handlers: true` to run them anyway."]},{code:`tasks:
  - name: Enable gzip
    ansible.builtin.copy:
      dest: /etc/nginx/conf.d/gzip.conf
      content: |
        gzip on;
        gzip_types text/plain text/css application/json;
      mode: "0644"
    notify: Reload nginx

  - name: Add security headers
    ansible.builtin.copy:
      dest: /etc/nginx/default.d/headers.conf
      content: |
        add_header X-Content-Type-Options nosniff;
      mode: "0644"
    notify: web config changed       # a topic, see listen below

  - name: Apply handlers now, before the smoke test
    ansible.builtin.meta: flush_handlers

  - name: Smoke test
    ansible.builtin.uri:
      url: http://localhost/

handlers:
  - name: Check nginx config
    ansible.builtin.command: nginx -t
    changed_when: false
    listen: web config changed

  - name: Reload nginx
    ansible.builtin.service:
      name: nginx
      state: reloaded
    listen: web config changed`,lang:`yaml`,file:`handlers.yml (excerpt)`},{callout:"Prefer `reloaded` over `restarted` when the service supports it: no dropped connections. Keep handler names unique across the whole play, including roles, or use `listen` topics.",tone:`tip`}],lab:{title:`Reload nginx only when configuration changes`,goal:`See a handler fire on change, stay quiet with no change, run early with flush_handlers, and get lost on failure.`,duration:`15 min`,steps:[{title:`Create the playbook`,code:{lang:`yaml`,file:`handlers.yml`,code:`---
- name: Handlers in action
  hosts: web
  become: true
  vars:
    gzip_enabled: "on"

  tasks:
    - name: Make sure nginx is installed and running
      ansible.builtin.service:
        name: nginx
        state: started

    - name: Configure gzip
      ansible.builtin.copy:
        dest: /etc/nginx/conf.d/gzip.conf
        content: |
          gzip {{ gzip_enabled }};
          gzip_types text/plain text/css application/json;
        mode: "0644"
      notify: web config changed

    - name: Apply handlers now
      ansible.builtin.meta: flush_handlers

    - name: Smoke test after the reload
      ansible.builtin.uri:
        url: http://localhost/
        status_code: [200, 404]

  handlers:
    - name: Check nginx config
      ansible.builtin.command: nginx -t
      changed_when: false
      listen: web config changed

    - name: Reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded
      listen: web config changed`}},{title:`First run: handlers fire`,code:{lang:`bash`,code:`$ ansible-playbook handlers.yml
...
RUNNING HANDLER [Check nginx config] *******************************************
ok: [node2]
RUNNING HANDLER [Reload nginx] *************************************************
changed: [node2]`}},{title:`Second run: nothing to do`,code:{lang:`bash`,code:`$ ansible-playbook handlers.yml | grep -c HANDLER     # 0`}},{title:`Change a value`,code:{lang:`bash`,code:`$ ansible-playbook handlers.yml -e gzip_enabled=off`}}],verify:{text:"Handlers appear only in runs where `gzip.conf` changed, and they run before the smoke test because of `flush_handlers`.",code:{lang:`bash`,code:`$ ansible web -b -a 'cat /etc/nginx/conf.d/gzip.conf'`}},challenge:'Add a task after the copy task that always fails (`ansible.builtin.fail: msg=boom`) and remove `flush_handlers`. Run with `-e gzip_enabled=on`: the handler does not run. Run again: still nothing, because the file no longer changes. This is the "lost handler" problem. Now try `--force-handlers` after another change.'},takeaways:[`Handlers run once, at the end of the play, only if notified by a change.`,"Use `listen` topics to chain validate-then-reload handlers.","Pending handlers are lost when a host fails: use `force_handlers` for critical reloads."]},{id:`l-templates`,title:`Jinja2 templates and filters`,duration:`35 min`,summary:`Generate configuration files from templates with variables, loops and conditions. Transform data with filters, validate files before they are installed, and read external data with lookups.`,prereqs:[`l-variables-facts`,`l-handlers`],objectives:["Write templates with expressions, `for` loops, `if` blocks and comments","Use the most common filters: `default`, `join`, `map`, `select`, `combine`, `to_nice_yaml`, `regex_replace`","Install a template safely with `validate` and back it up",`Read files, environment variables and passwords with lookups`],docs:[{label:`Templating (Jinja2)`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_templating.html`},{label:`Filters`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_filters.html`}],blocks:[{h:`Template syntax`},{table:{head:[`Syntax`,`Purpose`],rows:[["`{{ expr }}`",`Print an expression`],["`{% for x in list %} … {% endfor %}`",`Loop`],["`{% if cond %} … {% elif %} … {% else %} … {% endif %}`",`Condition`],["`{# comment #}`",`Comment, not rendered`],["`{{ var | filter(args) }}`",`Transform a value`],["`{%- … -%}`",`Strip whitespace before or after a tag`]]}},{diagram:`flowchart LR
  V["Variables<br/>inventory, play, role"] --> R
  F["Facts<br/>ansible_facts"] --> R
  T["Template file<br/>nginx.conf.j2"] --> R["Rendered on the<br/>control node"]
  R --> X["Copied to a temp file<br/>on the managed node"]
  X --> VAL{"validate command<br/>nginx -t -c %s"}
  VAL -->|passes| D["Moved into place<br/>/etc/nginx/nginx.conf"]
  VAL -->|fails| E(["Task fails,<br/>old file kept"])
  D --> H["notify: Reload nginx"]`,title:`How the template module works`},{p:`Templates render on the **control node**, so lookups and filters run there, not on the target. Only the finished file is sent to the node.`},{h:`A real template`},{code:`# {{ ansible_managed }}
user nginx;
worker_processes {{ nginx_workers }};
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    include /etc/nginx/conf.d/*.conf;
    access_log /var/log/nginx/access.log;

    server {
        listen {{ http_port }};
        server_name {{ inventory_hostname }};
        root {{ web_root }};

{% for path, target in redirects.items() %}
        location = {{ path }} { return 301 {{ target }}; }
{% endfor %}
        location / {
            try_files $uri $uri/ =404;
        }
    }
}`,lang:`jinja`,file:`templates/nginx.conf.j2`},{h:`Filters you will use daily`},{table:{head:[`Filter`,`Example`,`Result`],rows:[[`default`,"`{{ port | default(80) }}`",`Fallback if undefined`],[`join`,"`{{ ['a','b'] | join(',') }}`","`a,b`"],[`map / select / reject`,"`{{ users | selectattr('admin') | map(attribute='name') | list }}`",`Names of admin users`],[`combine`,"`{{ defaults | combine(overrides, recursive=true) }}`",`Merged dictionary`],[`dict2items / items2dict`,"`{{ {'a': 1} | dict2items }}`","`[{key: a, value: 1}]`"],[`to_nice_yaml / to_nice_json / from_json`,"`{{ config | to_nice_yaml }}`",`Serialise data into a file`],[`regex_replace / regex_search`,"`{{ host | regex_replace('\\.example\\.com$', '') }}`",`Short host name`],[`ipaddr family (ansible.utils)`,"`{{ '10.0.0.0/24' | ansible.utils.ipaddr('net') }}`",`Network maths`],[`password_hash`,"`{{ pw | password_hash('sha512') }}`",`Hash for the user module`]]}},{h:`Lookups`},{code:`ssh_key: "{{ lookup('ansible.builtin.file', '~/.ssh/id_ed25519.pub') }}"
build_id: "{{ lookup('ansible.builtin.env', 'CI_PIPELINE_ID') | default('local', true) }}"
db_password: "{{ lookup('ansible.builtin.password', 'credentials/db length=24 chars=ascii_letters,digits') }}"
hosts_in_web: "{{ query('ansible.builtin.inventory_hostnames', 'web') }}"`,lang:`yaml`},{callout:"`validate` runs your check command on the rendered temp file before replacing the real one, so a typo cannot take nginx, sshd or sudo down. Use it for every config that has a syntax checker: `nginx -t -c %s`, `visudo -cf %s`, `sshd -t -f %s`, `haproxy -c -f %s`.",tone:`tip`}],lab:{title:`Template the web tier`,goal:`Replace the static nginx setup with a fully templated, validated configuration and a dynamic home page built from facts and inventory.`,duration:`20 min`,steps:[{title:`Create the nginx template`,text:"Save the template from the lesson above as `templates/nginx.conf.j2`."},{title:`Create the page template`,code:{lang:`jinja`,file:`templates/index.html.j2`,code:`<!doctype html>
<title>{{ site_title }}</title>
<h1>{{ site_title | upper }}</h1>
<p>Served by <b>{{ inventory_hostname }}</b> ({{ ansible_facts['default_ipv4']['address'] | default('no IP') }})</p>
<p>{{ ansible_facts['distribution'] }} {{ ansible_facts['distribution_version'] }}, {{ ansible_facts['processor_vcpus'] }} vCPU</p>
<ul>
{% for host in groups['web'] | sort %}
  <li>{{ host }}{% if host == inventory_hostname %} (this server){% endif %}</li>
{% endfor %}
</ul>`}},{title:`Create the playbook`,code:{lang:`yaml`,file:`site.yml`,code:`---
- name: Templated nginx site with handlers
  hosts: web
  become: true
  vars:
    http_port: 80
    web_root: /srv/www
    site_title: Ansible course shop
    nginx_workers: auto
    redirects:
      /old: /
      /docs: https://docs.ansible.com/

  tasks:
    - name: Install nginx
      ansible.builtin.dnf:
        name: nginx
        state: present

    - name: Create the web root
      ansible.builtin.file:
        path: "{{ web_root }}"
        state: directory
        mode: "0755"

    - name: Deploy nginx.conf (checked with nginx -t before it is installed)
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
        mode: "0644"
        validate: nginx -t -c %s
      notify: Reload nginx

    - name: Deploy the home page
      ansible.builtin.template:
        src: index.html.j2
        dest: "{{ web_root }}/index.html"
        mode: "0644"

    - name: Ensure nginx is running
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true

  handlers:
    - name: Reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded`}},{title:`Run, then preview a change with diff`,code:{lang:`bash`,code:`$ ansible-playbook site.yml
$ ansible-playbook site.yml --check --diff -e nginx_workers=2`}},{title:`Break it on purpose`,text:"Introduce a syntax error in the template (delete a `;`), run again, and watch `validate` refuse it. The site stays up because the old file was kept. Then fix the template.",code:{lang:`bash`,code:`$ ansible-playbook site.yml
fatal: [node2]: FAILED! => ... failed to validate ...
$ curl -s -o /dev/null -w '%{http_code}\\n' http://node2/     # still 200`}}],verify:{text:"Each server shows its own name and IP, lists both web nodes, and `/old` redirects.",code:{lang:`bash`,code:`$ curl -s http://node3/ | grep Served
<p>Served by <b>node3</b> (10.89.0.4)</p>
$ curl -sI http://node2/old | head -1
HTTP/1.1 301 Moved Permanently`}},challenge:"Move `redirects` into `inventory/group_vars/web.yml` and add a per-host redirect in `host_vars/node3.yml`, merging the two with the `combine` filter in the template."},takeaways:[`Templates render on the control node; only the finished file goes to the host.`,"Always add `validate` for configs that have a checker, and `{{ ansible_managed }}` at the top.",`Shape data with filters in the template or in vars; keep logic in templates simple.`]}]};export{e as default};