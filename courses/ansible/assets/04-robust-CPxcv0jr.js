var e={id:`low-robust`,track:`low`,order:4,title:`Reliable playbooks`,icon:`ShieldCheck`,hue:30,blurb:`Make playbooks safe to run again and again: report changes honestly, handle failures with block and rescue, keep secrets in Ansible Vault, and roll changes out one server at a time behind a load balancer.`,lessons:[{id:`l-errors`,title:`Change control and error handling`,duration:`25 min`,summary:"A playbook should report `changed` only when it changed something and fail only when something is really wrong. `changed_when`, `failed_when`, `creates` and `removes` make commands honest; `block`, `rescue` and `always` let a play recover from a failure instead of stopping halfway.",prereqs:[`l-handlers`,`l-roles`],objectives:["Make `command` and `shell` tasks idempotent with `creates`, `removes` and `changed_when`","Define what counts as failure with `failed_when`","Recover from failures with `block`, `rescue` and `always`","Choose between `ignore_errors`, `any_errors_fatal` and `max_fail_percentage`"],docs:[{label:`Error handling in playbooks`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_error_handling.html`},{label:`Blocks`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_blocks.html`}],blocks:[{h:`Honest change reporting`},{p:"Ansible cannot know what a `command` or `shell` task did, so it reports `changed` every time. That breaks the second-run test (`changed=0`), triggers handlers for nothing and hides real changes. Tell Ansible how to judge the result."},{table:{head:[`Keyword`,`Effect`,`Use for`],rows:[["`creates: <path>`",`Skip the command if the path exists`,`One-time actions that leave a file behind: unpack, initialise, back up once`],["`removes: <path>`",`Run the command only if the path exists`,`Clean-up and migration steps`],["`changed_when: false`",`Never report a change`,`Read-only commands: versions, status, checks`],["`changed_when: <expression>`",`Report a change when the expression is true`,`Commands whose output says whether they changed something`],["`failed_when: <expression>`",`Replace the default rule (non-zero exit code means failure)`,"Commands that use exit codes for information, such as `grep` (1 = no match)"]]}},{code:`- name: Initialise the database once
  ansible.builtin.command: /usr/bin/postgresql-setup --initdb
  args:
    creates: /var/lib/pgsql/data/PG_VERSION

- name: Apply pending migrations
  ansible.builtin.command: /opt/app/bin/migrate
  register: migrate
  changed_when: "'Applied' in migrate.stdout"

- name: Is the old API still referenced? (grep exits 1 when not found)
  ansible.builtin.command: grep -rl "api/v1" /etc/app
  register: old_api
  changed_when: false
  failed_when: old_api.rc not in [0, 1]`,lang:`yaml`,title:`Typical patterns`},{h:`Block, rescue, always`},{diagram:`flowchart LR
  B["block<br/>tasks run in order"] -->|"all succeed"| A["always<br/>runs in every case"]
  B -->|"a task fails"| R["rescue<br/>clean up, roll back, report"]
  R -->|"rescue succeeds:<br/>host counts as rescued, play continues"| A
  R -->|"rescue fails too"| F(["host fails"])
  F --> A`,title:`How Ansible runs a block`},{list:["A failure inside `block` jumps to `rescue`. If the rescue tasks succeed, the host is **not** failed: the recap shows `rescued=1` and the play goes on.",'`always` runs whether the block succeeded, was rescued or failed: use it for clean-up and for "make sure the service is running".',"Inside `rescue`, `ansible_failed_task` and `ansible_failed_result` describe what went wrong.","Keywords on the block (`become`, `when`, `tags`) apply to every task inside it."]},{h:`When a host fails`},{table:{head:[`Setting`,`Behaviour`,`Use for`],rows:[[`Default`,`The failed host stops; other hosts carry on`,`Most plays`],["`ignore_errors: true` on a task",`The failure is reported but the host continues`,"Rarely: prefer `failed_when` with a precise rule"],["`any_errors_fatal: true` on the play",`One failed host stops the play on all hosts`,`Changes that must be all-or-nothing (cluster upgrades)`],["`max_fail_percentage: N` on the play",`Stop when more than N% of the hosts in a batch fail`,`Rolling updates (lesson E4.3)`]]}},{callout:"Every `ignore_errors: true` hides a question: which failure is acceptable? Write the answer down as a `failed_when` expression instead. Reviewers can then see exactly what is tolerated.",tone:`tip`}],lab:{title:`Validate a config change and roll it back`,goal:`Write a playbook whose commands report changes honestly, and that rolls back a configuration change nginx rejects instead of leaving a broken server.`,duration:`20 min`,steps:[{title:`Create the playbook`,text:"On **controller**, in `~/lab`.",code:{lang:`yaml`,file:`errors.yml`,code:`---
- name: Change control and error handling
  hosts: web
  become: true
  vars:
    extra_conf: "server_tokens off;"

  tasks:
    - name: Read the nginx version (only reads, so never a change)
      ansible.builtin.command: nginx -v
      register: nginx_version
      changed_when: false

    - name: Show it
      ansible.builtin.debug:
        msg: "{{ nginx_version.stderr }}"

    - name: Keep a copy of the original config, once
      ansible.builtin.command: cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.orig
      args:
        creates: /etc/nginx/nginx.conf.orig

    - name: Count redirect rules (grep exits 1 when there are none)
      ansible.builtin.command: grep -c "return 301" /etc/nginx/nginx.conf
      register: redirects
      changed_when: false
      failed_when: redirects.rc not in [0, 1]

    - name: Try a config change, and roll it back if nginx rejects it
      block:
        - name: Write the extra config
          ansible.builtin.copy:
            dest: /etc/nginx/conf.d/extra.conf
            content: "{{ extra_conf }}\\n"
            mode: "0644"

        - name: Validate the whole configuration
          ansible.builtin.command: nginx -t
          changed_when: false

      rescue:
        - name: Remove the rejected file
          ansible.builtin.file:
            path: /etc/nginx/conf.d/extra.conf
            state: absent

        - name: Report the rollback
          ansible.builtin.debug:
            msg: "nginx rejected '{{ extra_conf }}' on {{ inventory_hostname }}; change rolled back"

      always:
        - name: Make sure nginx is running, whatever happened
          ansible.builtin.service:
            name: nginx
            state: started`}},{title:`Run it twice`,code:{lang:`bash`,code:`$ ansible-playbook errors.yml
...
TASK [Keep a copy of the original config, once] ********************************
changed: [node2]
changed: [node3]
...
node2                      : ok=8    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
$ ansible-playbook errors.yml | tail -3
node2                      : ok=8    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
node3                      : ok=8    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0`}},{title:`Send a directive nginx does not know`,code:{lang:`bash`,code:`$ ansible-playbook errors.yml -e "extra_conf=this_is_not_a_directive;"
...
TASK [Validate the whole configuration] ****************************************
fatal: [node2]: FAILED! =>
    ...
    stderr: |-
        nginx: [emerg] unknown directive "this_is_not_a_directive" in /etc/nginx/conf.d/extra.conf:1
        nginx: configuration file /etc/nginx/nginx.conf test failed

TASK [Remove the rejected file] ************************************************
changed: [node2]
...
node2                      : ok=9    changed=2    unreachable=0    failed=0    skipped=0    rescued=1    ignored=0`}}],verify:{text:"The second run shows `changed=0`. The bad run ends with `failed=0` and `rescued=1` on both hosts, `extra.conf` is gone, and nginx still serves pages.",code:{lang:`bash`,code:`$ ansible web -b -a 'ls /etc/nginx/conf.d/'
$ curl -s http://node2/ | grep h1`}},solution:{text:"Without `changed_when: false`, the version and grep tasks would report a change on every run; without `creates`, the backup would overwrite `nginx.conf.orig` with the already-modified file on later runs. The rescue removes the file it wrote, which is the right rollback here because nothing else changed. For larger changes, validate before replacing (the `validate` option of `template` and `copy`) so there is nothing to roll back."},challenge:"In the rescue section, print `ansible_failed_task.name` and the first line of `ansible_failed_result.stderr`. Then make the rescue itself fail (for example by removing a file in a folder that does not exist) and see what the recap reports."},takeaways:["`creates`, `removes` and `changed_when` make command tasks idempotent","`failed_when` states exactly which results count as failure","`block`/`rescue`/`always` turn a failure into a controlled rollback; the recap shows `rescued`"]},{id:`l-vault`,title:`Secrets with Ansible Vault`,duration:`25 min`,summary:"Ansible Vault encrypts variables with AES-256 so secrets can live in the same Git repository as the playbooks. Keep encrypted values in a separate `vault.yml` next to a readable `vars.yml` that references them, keep the password outside the repository, and stop secrets leaking into logs with `no_log`.",prereqs:[`l-errors`],objectives:[`Encrypt a variables file and single values`,`Organise secrets with the vars/vault convention`,`Provide the vault password safely, from a file or a script`,"Keep secrets out of output with `no_log`"],docs:[{label:`Protecting sensitive data with Ansible Vault`,url:`https://docs.ansible.com/ansible/latest/vault_guide/index.html`}],blocks:[{table:{head:[`Command`,`What it does`],rows:[["`ansible-vault encrypt <file>`",`Encrypt a whole file in place`],["`ansible-vault view <file>` / `edit <file>`",`Show or edit an encrypted file (decrypted only in memory or a temporary file)`],["`ansible-vault encrypt_string <value> --name <var>`",`Print one encrypted variable to paste into a normal YAML file`],["`ansible-vault rekey <file>`",`Change the password of encrypted files`],["`ansible-vault decrypt <file>`",`Turn it back into plain text (rarely what you want)`]]}},{h:`The vars/vault convention`},{code:`inventory/group_vars/db/
├── vars.yml     # readable: every variable name, secrets point to vault_*
│     db_password: "{{ vault_db_password }}"
└── vault.yml    # encrypted: only the vault_* values
      vault_db_password: ...`,lang:`text`},{p:'With this layout, `grep` and code review still show **which** variables exist and where they are used, while the values stay encrypted. A whole file is either encrypted or not: do not append `encrypt_string` output to a file that is encrypted as a whole, or Ansible can no longer read it ("Vault format unhexlify error").'},{h:`Where the password comes from`},{table:{head:[`Option`,`How`,`Good for`],rows:[[`Prompt`,"`--ask-vault-pass`",`Occasional manual runs`],[`Password file`,"`--vault-password-file ~/.vault-pass`, or `vault_password_file` in `ansible.cfg`",`A workstation; the file lives outside the repository with mode 600`],[`Password script`,`An executable passed as the password file prints the password, for example from a secrets manager`,`CI pipelines and shared control nodes`],[`Vault IDs`,"`--vault-id prod@~/.vault-prod --vault-id dev@prompt`",`Different passwords per environment`],[`Automation controller`,`A Vault credential attached to the job template`,`Ansible Automation Platform`]]}},{callout:"Encryption protects the repository, not the run. Decrypted values appear in output, in registered variables and in `-v` logs unless the task uses `no_log: true`. Mark every task that handles a secret.",tone:`warn`},{callout:`For many secrets, rotation and audit, a secrets manager (for example HashiCorp Vault or a cloud secrets service, read with a lookup plugin) is a better source of truth than files. Ansible Vault is the simple, built-in option.`,tone:`arch`}],lab:{title:`Give the database host its credentials`,goal:`Encrypt a password file and a single token, deploy them to node4 without showing them in output, and configure the vault password once.`,duration:`20 min`,steps:[{title:`Create a vault password file`,text:`It lives in your home folder, outside the project, readable only by you.`,code:{lang:`bash`,code:`$ python3 -c "import secrets; print(secrets.token_urlsafe(24))" > ~/.vault-pass
$ chmod 600 ~/.vault-pass`}},{title:`Write the secret and encrypt it`,code:[{lang:`yaml`,file:`inventory/group_vars/db/vault.yml`,code:`---
vault_db_password: Sup3r-s3cret-DB`},{lang:`bash`,code:`$ ansible-vault encrypt --vault-password-file ~/.vault-pass inventory/group_vars/db/vault.yml
Encryption successful
$ head -1 inventory/group_vars/db/vault.yml
$ANSIBLE_VAULT;1.1;AES256`}]},{title:`Write the readable variables, then add an encrypted token`,code:[{lang:`yaml`,file:`inventory/group_vars/db/vars.yml`,code:`---
db_user: shop
db_password: "{{ vault_db_password }}"`},{lang:`bash`,code:`$ ansible-vault encrypt_string --vault-password-file ~/.vault-pass "tok-8f2c1d" --name api_token >> inventory/group_vars/db/vars.yml
$ cat inventory/group_vars/db/vars.yml
---
db_user: shop
db_password: "{{ vault_db_password }}"
api_token: !vault |
          $ANSIBLE_VAULT;1.1;AES256
          31316230366630376633356131336662326635373335333737633261616665323961376130383537
          ...`}]},{title:`Create the playbook`,code:{lang:`yaml`,file:`secrets.yml`,code:`---
- name: Give the database host its credentials
  hosts: db
  become: true

  tasks:
    - name: Create the application config folder
      ansible.builtin.file:
        path: /etc/app
        state: directory
        mode: "0750"

    - name: Write the database credentials
      ansible.builtin.copy:
        dest: /etc/app/db.env
        content: |
          DB_USER={{ db_user }}
          DB_PASSWORD={{ db_password }}
          API_TOKEN={{ api_token }}
        mode: "0600"
      no_log: true`}},{title:`Run it without, then with the password`,code:{lang:`bash`,code:`$ ansible-playbook secrets.yml
[ERROR]: Attempting to decrypt but no vault secrets found.
$ ansible-playbook secrets.yml --vault-password-file ~/.vault-pass | tail -2
node4                      : ok=3    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0`}},{title:`Configure the password file once`,text:"Every command that loads the db group variables now needs the password, even ad-hoc ones. Add it to `ansible.cfg` under `[defaults]`.",code:{lang:`bash`,code:`$ sed -i '/^\\[defaults\\]/a vault_password_file = ~/.vault-pass' ansible.cfg
$ grep vault ansible.cfg
vault_password_file = ~/.vault-pass
$ ansible-vault view inventory/group_vars/db/vault.yml
---
vault_db_password: Sup3r-s3cret-DB`}}],verify:{text:"The credentials file on node4 has mode 600 and the decrypted values; the playbook output never shows them; a second run reports `changed=0`.",code:{lang:`bash`,code:`$ ansible db -b -a 'stat -c "%a %U %n" /etc/app/db.env'
node4 | CHANGED | rc=0 >>
600 root /etc/app/db.env
$ ansible-playbook secrets.yml | tail -2
node4                      : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0`}},solution:{text:'The error without a password comes from loading inventory variables, before any task runs: Ansible decrypts vaulted variables when it needs them, so every play or ad-hoc command against node4 needs the password. In a pipeline, `vault_password_file` would point at a script that fetches the password from the CI system\'s secret store. Remember that `ansible db -a "cat /etc/app/db.env"` prints the secret: encryption protects the repository, not the hosts.'},challenge:"Remove `no_log: true`, run with `-v` and look at what the copy task prints. Then rotate the password with `ansible-vault rekey` (create a new password file first) and run the playbook again."},takeaways:["Encrypt `vault_*` values in `vault.yml`; reference them from a readable `vars.yml`",`Keep the password outside the repository: a file with mode 600, a script, or vault IDs per environment`,"Use `no_log: true` on every task that handles a secret"]},{id:`l-rolling`,title:`Check mode, diffs and rolling updates`,duration:`30 min`,summary:"Preview a change with `--check --diff`, then roll it out one server at a time: `serial` runs the play in batches, `delegate_to` drains each server from the load balancer before it is updated, and `max_fail_percentage` stops the release when a server fails. Users never see an error.",prereqs:[`l-errors`,`l-roles`],objectives:[`Preview changes safely with check mode and diffs`,"Run a play in batches with `serial` and stop on failure","Act on another host with `delegate_to`",`Update a load-balanced web tier without failed requests`],docs:[{label:`Controlling playbook execution: strategies, serial`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_strategies.html`},{label:`Delegation and local actions`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_delegation.html`},{label:`Check mode and diff mode`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_checkmode.html`}],blocks:[{h:`Preview first`},{list:["`--check` asks every module to predict what it would change without changing it. `--diff` shows the before and after of files and templates. Together they are the safest way to review a change on real servers.","Modules that cannot predict (`command`, `shell`) are skipped in check mode. A task that depends on a package installed earlier in the same run may fail in check mode, because the package was not really installed.","`check_mode: false` on a task makes it run even in check mode (for read-only commands whose output later tasks need); `ansible_check_mode` tells a task whether it is in check mode."]},{h:`Rolling updates`},{diagram:`sequenceDiagram
  participant A as Ansible
  participant LB as node1 (haproxy)
  participant W2 as node2
  participant W3 as node3
  Note over A: serial 1: batch 1 = node2
  A->>LB: delegate_to: mark node2 disabled, reload
  A->>W2: update with the nginx role
  A->>W2: wait until the new release answers
  A->>LB: delegate_to: enable node2, reload
  Note over A: batch 2 = node3
  A->>LB: mark node3 disabled, reload
  A->>W3: update, check
  A->>LB: enable node3, reload
  Note over LB: node2 or node3 serves every request throughout`,title:`One server at a time, drained from the load balancer`},{table:{head:[`Keyword`,`Effect`],rows:[['`serial: 1`, `serial: "25%"`, `serial: [1, 5, "50%"]`',`Run the whole play on batches of hosts: a fixed size, a percentage, or growing batches (a canary first)`],["`max_fail_percentage: 0`",`Stop the play when more than this percentage of a batch fails; 0 stops at the first failure`],["`delegate_to: <host>`",`Run this task on another host, with the current host's variables`],["`run_once: true`",`Run a task once for the whole batch, for example a database migration`],["`throttle: N`",`Limit how many hosts run one task at the same time`],["`order: sorted` / `shuffle` / ...",`Control the order hosts are processed in`]]}},{callout:"Order matters inside a play: `pre_tasks`, then `roles`, then `tasks`, then `post_tasks`, with handlers flushed after each section. That is why draining belongs in `pre_tasks` and the health check and re-enabling in `post_tasks`: the nginx reload notified by the role has run by then.",tone:`tip`}],lab:{title:`Release a new version with zero failed requests`,goal:`Put haproxy on node1 in front of node2 and node3, preview a release, then roll it out one server at a time while a client keeps sending requests.`,duration:`25 min`,steps:[{title:`Create the load balancer template`,text:"node1 already has haproxy (installed in lesson E2.3). Each web server gets a health check; a server listed in `lb_drain` is disabled.",code:{lang:`jinja`,file:`templates/haproxy.cfg.j2`,code:`# {{ ansible_managed }}
global
    log /dev/log local0
    maxconn 2000
    user haproxy
    group haproxy

defaults
    mode http
    log global
    timeout connect 5s
    timeout client 30s
    timeout server 30s

frontend web
    bind *:80
    default_backend web

backend web
    balance roundrobin
    option httpchk GET /
{% for host in groups['web'] | sort %}
    server {{ host }} {{ host }}:80 check{{ ' disabled' if host in (lb_drain | default([])) else '' }}
{% endfor %}`}},{title:`Configure the load balancer`,code:[{lang:`yaml`,file:`lb.yml`,code:`---
- name: Load balancer for the web tier
  hosts: lb
  become: true

  tasks:
    - name: Configure haproxy
      ansible.builtin.template:
        src: haproxy.cfg.j2
        dest: /etc/haproxy/haproxy.cfg
        mode: "0644"
        validate: haproxy -c -f %s
      notify: Reload haproxy

    - name: Start and enable haproxy
      ansible.builtin.service:
        name: haproxy
        state: started
        enabled: true

  handlers:
    - name: Reload haproxy
      ansible.builtin.service:
        name: haproxy
        state: reloaded`},{lang:`bash`,code:`$ ansible-playbook lb.yml | tail -2
$ for i in 1 2 3 4; do curl -s node1/ | grep -o "Served by <b>node[0-9]"; done
Served by <b>node2
Served by <b>node3
Served by <b>node2
Served by <b>node3`}]},{title:`Write the release playbook`,code:{lang:`yaml`,file:`rolling.yml`,code:`---
- name: Rolling release of the web tier
  hosts: web
  become: true
  serial: 1                  # one server at a time
  max_fail_percentage: 0     # stop the whole release if any server fails
  vars:
    nginx_site_title: "Release {{ release }}"

  pre_tasks:
    - name: Take this server out of the load balancer
      ansible.builtin.template:
        src: haproxy.cfg.j2
        dest: /etc/haproxy/haproxy.cfg
        mode: "0644"
        validate: haproxy -c -f %s
      vars:
        lb_drain: ["{{ inventory_hostname }}"]
      delegate_to: "{{ item }}"
      loop: "{{ groups['lb'] }}"

    - name: Reload haproxy without this server
      ansible.builtin.service:
        name: haproxy
        state: reloaded
      delegate_to: "{{ item }}"
      loop: "{{ groups['lb'] }}"

  roles:
    - nginx

  post_tasks:
    - name: Wait until the new release answers on this server
      ansible.builtin.uri:
        url: http://localhost/
        return_content: true
      register: page
      until: nginx_site_title in page.content
      retries: 5
      delay: 2

    - name: Put this server back into the load balancer
      ansible.builtin.template:
        src: haproxy.cfg.j2
        dest: /etc/haproxy/haproxy.cfg
        mode: "0644"
        validate: haproxy -c -f %s
      delegate_to: "{{ item }}"
      loop: "{{ groups['lb'] }}"

    - name: Reload haproxy with this server back in
      ansible.builtin.service:
        name: haproxy
        state: reloaded
      delegate_to: "{{ item }}"
      loop: "{{ groups['lb'] }}"`}},{title:`Preview the release on one server`,code:{lang:`bash`,code:`$ ansible-playbook rolling.yml -e release=2 --check --diff --limit node2
...
-    server node2 node2:80 check
+    server node2 node2:80 check disabled
...
-<title>From a collection</title>
+<title>Release 2</title>
...
node2                      : ok=14   changed=4    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0`}},{title:`Release while a client keeps requesting the site`,text:"The loop sends a request every 0.3 seconds in the background and writes the page title, or FAILED REQUEST, to `watch.log`.",code:{lang:`bash`,code:`$ ( for i in $(seq 60); do curl -s -m 2 node1/ | grep -o "<title>[^<]*" || echo "FAILED REQUEST"; sleep 0.3; done > watch.log ) &
$ ansible-playbook rolling.yml -e release=2 | grep -E "^PLAY |node[23] +:"
$ wait; sort watch.log | uniq -c
     26 <title>From a collection
     34 <title>Release 2`}}],verify:{text:"The output shows two `PLAY` batches, node2 first and then node3. `watch.log` contains only page titles, old and new, and no `FAILED REQUEST`: every request was answered while each server was updated. The haproxy configuration ends with both servers enabled.",code:{lang:`bash`,code:`$ ansible lb -b -a 'grep "server node" /etc/haproxy/haproxy.cfg'
$ curl -s node1/ | grep -o "<title>[^<]*"`}},solution:{text:"Your counts will differ (they depend on timing), but there are no failed requests. haproxy is reloaded gracefully, so connections in flight finish, and the drained server receives no new requests while nginx is updated. Without the pre-task, some requests during the update could reach a server that is reloading; with `serial` removed, both servers would be updated at the same time."},challenge:'Make the release fail on the first server (for example `-e release="2" -e nginx_http_port=notaport`). Does node3 still get updated? Which `max_fail_percentage` value would let one failure out of two pass, and would you want that?'},takeaways:["`--check --diff` previews changes on real servers without making them","`serial` and `max_fail_percentage` turn a play into a controlled, stoppable rollout","`delegate_to` drains and restores each server on the load balancer around its update"]}]};export{e as default};