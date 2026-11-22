var e={id:`low-getting-started`,track:`low`,order:1,title:`Getting started`,icon:`Terminal`,hue:160,blurb:`Start the browser-based practice lab, understand how Ansible is installed and configured, describe your hosts in an inventory, and run your first ad-hoc commands.`,lessons:[{id:`l-lab-setup`,title:`Build your lab`,duration:`15 min`,summary:"Start an Ansible control node and four Rocky Linux 9 managed nodes with one `docker compose up`, then work entirely in browser terminals. Nothing but Docker is needed on your machine. Every hands-on lab in the course runs here.",objectives:[`Understand the lab topology: a workstation gateway, a control node and four managed nodes in three groups`,`Start, pause and reset the lab with Docker Compose`,`Prove Ansible on the controller can reach and escalate privileges on every node`],docs:[{label:`Installing Ansible`,url:`https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html`}],blocks:[{h:`Lab topology`},{p:"Ansible needs a **control node**, where you run commands, and **managed nodes**, which it configures over SSH. In this lab both are containers: `controller` has ansible-core and ansible-lint installed, and `node1`–`node4` run systemd and sshd, so they behave like small virtual machines. A **workstation** container serves a web page at `http://localhost:28201` and opens browser terminals on any of them. Only that web port is published, and only on `127.0.0.1`."},{diagram:`flowchart LR
  B["Your browser<br/>localhost:28201"] -->|"HTTP + WebSocket"| WS["workstation<br/>web UI, terminals, web proxy"]
  subgraph NET["Private lab network"]
    WS -->|"SSH (your terminals)"| CTL["controller<br/>ansible-core, ansible-lint<br/>project in ~/lab"]
    WS -->|"SSH"| N1
    CTL -->|"SSH (Ansible)"| N1["node1<br/>group: lb"]
    CTL -->|"SSH"| N2["node2<br/>group: web"]
    CTL -->|"SSH"| N3["node3<br/>group: web"]
    CTL -->|"SSH"| N4["node4<br/>group: db"]
    N1 -->|"HTTP"| N2
    N1 -->|"HTTP"| N3
  end`,title:`Lab topology`},{table:{head:[`Machine`,`Group`,`Used for`,`Web page in your browser`],rows:[[`controller`,`(control node)`,"Running Ansible; the project lives in `~/lab`",`(none)`],[`node1`,`lb`,`HAProxy load balancer`,"`http://localhost:28201/web/node1/`"],[`node2`,`web`,`nginx web server`,"`http://localhost:28201/web/node2/`"],[`node3`,`web`,`nginx web server`,"`http://localhost:28201/web/node3/`"],[`node4`,`db`,`PostgreSQL database`,`(none)`]]}},{p:"Every machine has the user `ansible` with passwordless sudo. The controller has its own SSH key, which all nodes trust, so Ansible connects without passwords. From the controller you reach the nodes by name (`node1`…`node4`), and from there `curl http://node2/` tests a web server directly."},{callout:`Containers are a convenient stand-in for VMs. A few things differ: there is no kernel of their own, so modules that load kernel modules, change sysctl values, or manage disks will not work here. The course labs avoid those.`,tone:`note`},{h:`Requirements`},{list:["Docker with the Compose plugin (`docker compose version`), on Linux, macOS, or Windows with WSL2.",`About 2 GB of disk for the images and 1.5 GB of RAM while the lab runs.`,`Port 28201 free on your machine, and a web browser.`,"Internet access the first time (images and packages), and later for `dnf install` and `ansible-galaxy` in the labs."]},{h:`The lab kit`},{p:"The kit is the `lab/` folder of the course you downloaded and unzipped, next to its README. Everything the lab needs is inside it, so you can move or copy the folder as a whole."},{table:{head:[`File`,`Purpose`],rows:[["`docker-compose.yml`",`The topology: workstation, controller, four nodes, network and volumes`],["`lab.yaml`",`The machine list and web links shown in the browser`],["`controller/`","The control node image (Python 3.12, ansible-core, ansible-lint) and the starting project: `ansible.cfg` and `inventory/hosts.ini`"],["`node/`",`The managed-node image: Rocky Linux 9 with systemd and sshd`],["`workstation/`","Lab-specific additions to the shared workstation, such as the `/web/<node>/` proxy"],["`shared/workstation/`",`The browser gateway that every course lab uses: web UI, terminals and status checks`]]}},{code:`[defaults]
inventory = ./inventory/hosts.ini
remote_user = ansible
private_key_file = ~/.ssh/id_ed25519
host_key_checking = False
interpreter_python = auto_silent
roles_path = ./roles
collections_path = ./collections
retry_files_enabled = False
stdout_callback = default
callback_result_format = yaml
forks = 10

[privilege_escalation]
become = False
become_method = sudo

[ssh_connection]
pipelining = True
ssh_args = -o ControlMaster=auto -o ControlPersist=60s -o UserKnownHostsFile=/dev/null`,lang:`ini`,file:`~/lab/ansible.cfg (on controller)`},{code:`[lb]
node1

[web]
node2
node3

[db]
node4

[app:children]
lb
web
db`,lang:`ini`,file:`~/lab/inventory/hosts.ini (on controller)`},{callout:"`host_key_checking = False` and `UserKnownHostsFile=/dev/null` are there because lab nodes are recreated often and get new host keys each time. Never use these settings against real servers: they turn off protection against man-in-the-middle attacks.",tone:`warn`},{table:{head:[`Command (in the lab folder)`,`What it does`],rows:[["`docker compose up -d`",`Build the images on first use, then start or resume the lab`],["`docker compose stop`",`Pause the lab, keeping your project and node changes`],["`docker compose down`","Remove the containers: nodes come back clean, your `~/lab` project is kept"],["`docker compose down -v`",`Remove everything, including the project, for a completely fresh lab`]]}},{callout:"Your work on the controller (`~/lab`: playbooks, roles, inventory changes) lives in a Docker volume, so it survives restarts and `docker compose down`. The managed nodes keep no volume: `docker compose down && docker compose up -d` gives you four clean nodes, which is handy before a lab that should start from scratch.",tone:`tip`}],lab:{title:`Start the lab and say hello to every node`,goal:`Bring up the lab, open a terminal on the controller, then use Ansible to ping every node and run a command as root on each.`,duration:`10 min`,steps:[{title:`Start the lab`,text:"On your machine, open a terminal in the folder where you unzipped the course and go into its `lab/` folder. The first run builds three small images, which takes a few minutes; later starts take seconds.",code:{lang:`bash`,code:`$ cd lab
$ docker compose up -d
 ✔ Container ansible-lab-workstation-1  Started
 ✔ Container ansible-lab-controller-1   Started
 ✔ Container ansible-lab-node1-1        Started
 ...`}},{title:`Open the lab in your browser`,text:"Go to **http://localhost:28201** and click **controller**. The terminal opens in `~/lab`. This is the last time you need your own terminal."},{title:`Check the installation`,code:{lang:`bash`,title:`On controller`,code:`$ ansible --version
ansible [core 2.21.5]
  config file = /home/ansible/lab/ansible.cfg
  ...
  python version = 3.12...`}},{title:`Ping every node`,text:"The `ping` module is not ICMP ping. It logs in over SSH, runs a tiny Python module, and returns `pong`. That proves SSH, authentication and Python all work.",code:{lang:`bash`,title:`On controller`,code:`$ ansible all -m ping
node1 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
...`}},{title:`Run a command as root`,text:"`-b` (become) uses sudo on the node. `-a` passes the command to run.",code:{lang:`bash`,title:`On controller`,code:`$ ansible all -b -a 'id -un'
node2 | CHANGED | rc=0 >>
root
...`}}],verify:{text:"All four nodes answer `pong`, and every machine in the browser has a green dot. You can also open a terminal on a node directly, or SSH to it from the controller.",code:{lang:`bash`,title:`On controller`,code:`$ ssh node2
[ansible@node2 ~]$ systemctl is-system-running
running
[ansible@node2 ~]$ exit`}},solution:{text:"Most problems are one of these. `Permission denied (publickey)` or no inventory: you are not in `~/lab`, so `ansible.cfg` was not found; check the `config file` line of `ansible --version`. `Connection refused`: the nodes are still booting, so wait a few seconds and retry. If a machine shows a red dot, check `docker compose ps` and `docker compose logs <machine>` on your machine. `docker compose down && docker compose up -d` recreates every node from scratch."},challenge:'Run `ansible all -m setup -a "filter=ansible_distribution*"` and read the facts Ansible gathers about each node. You will use facts a lot in later lessons.'},takeaways:[`The controller runs Ansible; managed nodes only need SSH and Python.`,"Work in `~/lab` on the controller so its `ansible.cfg` and inventory are used.","`docker compose down && docker compose up -d` gives you clean nodes at any time while keeping your project."]},{id:`l-install-config`,title:`Installation and configuration`,duration:`20 min`,summary:"The difference between ansible-core and the ansible package, how to install each, and how `ansible.cfg` is found and overridden.",prereqs:[`l-lab-setup`],objectives:["Choose between `ansible-core`, the `ansible` community package, and execution environments",`Explain the order in which Ansible finds its configuration file`,"Inspect and override settings with `ansible-config` and environment variables"],docs:[{label:`Configuring Ansible`,url:`https://docs.ansible.com/ansible/latest/reference_appendices/config.html`}],blocks:[{h:`What to install`},{table:{head:[`Option`,`Contains`,`Use when`],rows:[["`ansible-core`","The engine, CLI tools, and the `ansible.builtin` collection only",`You control exactly which collections you add (recommended for teams)`],["`ansible` (community package)","`ansible-core` plus about 85 curated collections",`Learning, or quick access to many modules without managing requirements`],[`Execution environment`,`A container image with ansible-core, collections, and Python dependencies`,`Repeatable runs in CI and in Ansible Automation Platform (see E5.4)`]]}},{code:`# Isolated install in a virtual environment (good practice for projects)
$ python3.12 -m venv ~/.venvs/ansible
$ source ~/.venvs/ansible/bin/activate
$ pip install ansible-core ansible-lint

# Pin versions for a team in requirements.txt
$ pip install 'ansible-core>=2.20,<2.22'`,lang:`bash`},{p:"The lab controller was built exactly this way: a Python 3.12 virtual environment in `/opt/ansible` with ansible-core 2.21 and ansible-lint, put on the `PATH` for every login. Recent ansible-core releases need Python 3.12 or newer on the control node, while managed nodes only need a supported Python (the lab nodes use Rocky Linux 9's Python 3.9)."},{h:`Where configuration comes from`},{p:`Ansible uses the **first** config file it finds. It does not merge files. Command-line options and environment variables then override individual settings.`},{diagram:`flowchart TD
  A["ANSIBLE_CONFIG env variable"] -->|not set| B["./ansible.cfg in the current directory"]
  B -->|not found| C["~/.ansible.cfg"]
  C -->|not found| D["/etc/ansible/ansible.cfg"]
  D -->|not found| E["Built-in defaults"]
  A -.->|set| F(("Used"))
  B -.->|found| F
  C -.->|found| F
  D -.->|found| F`,title:`Config file lookup order`},{p:"Precedence for a single setting, from lowest to highest: config file, then environment variable (for example `ANSIBLE_FORKS`), then command-line flag (for example `--forks`), then a playbook keyword or variable such as `ansible_user`."},{callout:"Ansible ignores `ansible.cfg` in a world-writable directory, for security. If your settings are ignored on a shared or mounted folder, that is usually why.",tone:`warn`},{h:`Settings worth knowing`},{table:{head:[`Setting`,`Section`,`What it does`],rows:[["`inventory`",`defaults`,`Default inventory path(s), comma-separated`],["`remote_user`",`defaults`,`SSH user when none is set in inventory`],["`forks`",`defaults`,`How many hosts run in parallel (default 5)`],["`roles_path` / `collections_path`",`defaults`,`Where roles and collections are looked up and installed`],["`become` / `become_method`",`privilege_escalation`,`Turn on sudo (or su, doas…) by default`],["`pipelining`",`ssh_connection`,"Fewer SSH round trips per task; big speed-up. Needs `requiretty` off in sudoers"],["`stdout_callback`",`defaults`,"Output format; `callback_result_format = yaml` makes results readable"]]}},{code:`$ ansible-config dump --only-changed     # what differs from defaults, and where it came from
$ ansible-config list | less              # every setting with its env var and ini key
$ ansible-config init --disabled > full.cfg   # a fully commented template
$ ANSIBLE_FORKS=20 ansible all -m ping    # one-off override`,lang:`bash`}],lab:{title:`Find and change your configuration`,goal:`Confirm which config file is active, see what it changes, and prove the precedence order.`,duration:`10 min`,steps:[{title:`See the active file and the changed settings`,text:"All steps run on **controller**, in `~/lab`.",code:{lang:`bash`,code:`$ ansible --version | grep 'config file'
$ ansible-config dump --only-changed`}},{title:`Override with an environment variable`,text:`Change the output callback for one command only, then compare.`,code:{lang:`bash`,code:`$ ANSIBLE_STDOUT_CALLBACK=minimal ansible web -m ping
$ ansible-config dump --only-changed | grep -i callback`}},{title:`Override with ANSIBLE_CONFIG`,text:"Point Ansible at a different file and watch the `config file` line change. Then unset it.",code:{lang:`bash`,code:`$ ansible-config init --disabled > /tmp/full.cfg
$ ANSIBLE_CONFIG=/tmp/full.cfg ansible --version | grep 'config file'
$ ANSIBLE_CONFIG=/tmp/full.cfg ansible all -m ping   # fails: no inventory or key configured`}}],verify:{text:"You can say which file is active, which settings it changes, and why the last command failed: with `ANSIBLE_CONFIG` set, `~/lab/ansible.cfg` was not read at all, because files are never merged."},challenge:'Add `[defaults] forks = 2` to a copy of the lab config, point `ANSIBLE_CONFIG` at it, and run `ansible all -a "sleep 3"`. Time it with `time` and compare with the normal config.'},takeaways:["Install `ansible-core` and declare collections explicitly for reproducible automation.","Exactly one `ansible.cfg` is used: `ANSIBLE_CONFIG`, then the current directory, then home, then `/etc/ansible`.","`ansible-config dump --only-changed` is the fastest way to debug configuration."]},{id:`l-inventory`,title:`Inventory: hosts, groups and variables`,duration:`30 min`,summary:"Describe your managed nodes in INI or YAML, organise them into groups and child groups, attach variables with `group_vars` and `host_vars`, and target them with patterns.",prereqs:[`l-lab-setup`],objectives:[`Write static inventories in INI and YAML formats`,"Use groups, child groups, and the implicit `all` and `ungrouped` groups","Keep variables in `group_vars/` and `host_vars/` instead of the inventory file","Target hosts with patterns and `--limit`"],docs:[{label:`Building an inventory`,url:`https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html`}],blocks:[{h:`What the inventory holds`},{p:`The inventory tells Ansible **which machines exist**, **how to reach them**, and **what they are** (by group). It can be a file, a folder of files, or a plugin that queries a cloud or CMDB. Everything Ansible targets comes from the inventory.`},{diagram:`flowchart TD
  ALL["all"] --> APP["app"]
  ALL --> UNG["ungrouped"]
  APP --> LB["lb"]
  APP --> WEB["web"]
  APP --> DB["db"]
  LB --> n1(["node1"])
  WEB --> n2(["node2"])
  WEB --> n3(["node3"])
  DB --> n4(["node4"])`,title:`Lab inventory as a group tree`},{h:`INI and YAML formats`},{code:`[lb]
node1

[web]
node2
node3

[db]
node4 ansible_port=22    # connection variables can sit next to a host

[app:children]     # app is a group of groups
lb
web
db`,lang:`ini`,file:`inventory/hosts.ini`},{code:`all:
  children:
    app:
      children:
        lb:
          hosts:
            node1:
        web:
          hosts:
            node2:
            node3:
        db:
          hosts:
            node4: { ansible_port: 22 }`,lang:`yaml`,file:`inventory/hosts.yml (same inventory in YAML)`},{callout:"Ranges save typing in big inventories: `web[01:20].example.com` expands to 20 hosts, and `db-[a:c].example.com` to three.",tone:`tip`},{h:`Connection variables`},{table:{head:[`Variable`,`Meaning`],rows:[["`ansible_host`",`Address to connect to, if different from the inventory name`],["`ansible_port`",`SSH port (default 22)`],["`ansible_user`",`Login user`],["`ansible_connection`","`ssh` (default), `local`, `winrm`, `network_cli`, `httpapi`, `podman`…"],["`ansible_python_interpreter`",`Python path on the node; usually auto-discovered`],["`ansible_become` / `ansible_become_user`",`Turn on privilege escalation for this host or group`]]}},{h:`group_vars and host_vars`},{p:"Keep the inventory file for hosts and groups only. Put variables in YAML files beside it: `group_vars/<group>.yml` (or a folder `group_vars/<group>/`) and `host_vars/<host>.yml`. Ansible loads them automatically for any host in that group, and they are easy to review in Git."},{code:`inventory/
├── hosts.ini
├── group_vars/
│   ├── all.yml          # applies to every host
│   ├── web.yml          # applies to node2, node3
│   └── db/
│       ├── main.yml
│       └── vault.yml    # encrypted secrets (see E4.2)
└── host_vars/
    └── node3.yml        # only node3`,lang:`text`,title:`Layout`},{p:"When the same variable is set at several levels, the more specific one wins: `host_vars` beats child group, child group beats parent group, and any group beats `all`. Lesson E2.2 covers the full precedence list."},{h:`Patterns: choosing hosts`},{table:{head:[`Pattern`,`Selects`],rows:[["`all` or `*`",`Every host`],["`web`",`Hosts in group web`],["`web:db`",`Union: web or db`],["`app:!db`",`Difference: app but not db`],["`web:&staging`",`Intersection: in web and in staging`],["`node[2:3]`, `~node[23]`","Ranges of names, or a regular expression with `~`"]]}},{code:`$ ansible-inventory --graph                 # tree of groups and hosts
$ ansible-inventory --host node3            # all variables for one host, after merging
$ ansible-inventory --list -y | less        # whole inventory as YAML
$ ansible 'app:!db' --list-hosts            # test a pattern without running anything
$ ansible-playbook site.yml --limit node2   # restrict a playbook run`,lang:`bash`}],lab:{title:`Organise the lab inventory with variables`,goal:`Add an environment group and variables at several levels, then prove which value each host ends up with.`,duration:`15 min`,steps:[{title:`Look at the current tree`,text:"All steps run on **controller**, in `~/lab`. Edit files with `nano` or `vim`.",code:{lang:`bash`,code:`$ ansible-inventory --graph`}},{title:`Add a staging group`,text:"Append this to `inventory/hosts.ini`. A host can belong to many groups.",code:{lang:`ini`,file:`inventory/hosts.ini (append)`,code:`[staging]
node2
node4`}},{title:`Create variables at three levels`,code:[{lang:`yaml`,file:`inventory/group_vars/all.yml`,code:`---
ntp_server: pool.ntp.org
http_port: 80
motd: "Managed by Ansible"`},{lang:`yaml`,file:`inventory/group_vars/web.yml`,code:`---
http_port: 8000
motd: "Web tier: managed by Ansible"`},{lang:`yaml`,file:`inventory/host_vars/node3.yml`,code:`---
http_port: 9000`}]},{title:`Inspect the merged result`,code:{lang:`bash`,code:`$ ansible-inventory --host node1 | grep -E 'http_port|motd'
$ ansible-inventory --host node2 | grep -E 'http_port|motd'
$ ansible-inventory --host node3 | grep -E 'http_port|motd'
$ ansible 'web:&staging' --list-hosts
$ ansible 'app:!web' --list-hosts`}}],verify:{text:"node1 has port 80 from `all`; node2 has 8000 from `web`; node3 has 9000 from `host_vars`. The pattern `web:&staging` lists only node2, and `app:!web` lists node1 and node4."},solution:{text:"If a value does not change, check the file location: `group_vars/` and `host_vars/` must sit next to the inventory file (or next to the playbook). The file name must match the group or host name exactly, with a `.yml` or `.yaml` extension, or no extension."},challenge:"Convert the whole inventory to `inventory/hosts.yml`, move `hosts.ini` aside, and confirm `ansible-inventory --graph` prints the same tree."},takeaways:[`Inventory = which hosts, how to reach them, and which groups they belong to.`,"Keep variables in `group_vars/` and `host_vars/`, not inline in the hosts file.","Use `ansible-inventory --graph` and `--host` to debug before running anything."]},{id:`l-adhoc`,title:`Ad-hoc commands and modules`,duration:`25 min`,summary:`Run single modules against many hosts from the command line, find module documentation, and learn the modules you will use every day.`,prereqs:[`l-inventory`],objectives:["Run ad-hoc commands with `ansible <pattern> -m <module> -a <args>`","Read module documentation with `ansible-doc`","Tell `command`, `shell`, and purpose-built modules apart, and know when to use each","Read `ok`, `changed`, and `failed` results"],docs:[{label:`Ad-hoc commands`,url:`https://docs.ansible.com/ansible/latest/command_guide/intro_adhoc.html`},{label:`ansible.builtin modules`,url:`https://docs.ansible.com/ansible/latest/collections/ansible/builtin/index.html`}],blocks:[{h:`Anatomy of an ad-hoc command`},{code:`$ ansible web -b -m ansible.builtin.dnf -a "name=nginx state=present" --forks 10
#        │    │   │                         │                           │
#  pattern  become  module (FQCN)          module arguments            run options`,lang:`bash`},{p:`An ad-hoc command runs **one module** against a set of hosts. Use it for quick checks, one-off fixes, and exploring. Anything you will repeat belongs in a playbook.`},{diagram:`sequenceDiagram
  participant U as You
  participant C as Control node
  participant N as Managed node
  U->>C: ansible web -m dnf -a ...
  C->>C: Read inventory, resolve pattern, load vars
  C->>N: SSH connect (one connection per host, up to forks)
  C->>N: Copy module as a small Python payload
  N->>N: Run module, compare current vs desired state
  N-->>C: JSON result: changed, msg, facts
  C->>N: Remove temp files
  C-->>U: node2 | CHANGED, node3 | SUCCESS`,title:`What happens when a module runs`},{h:`Reading results`},{table:{head:[`Status`,`Colour`,`Meaning`],rows:[["`ok` / `SUCCESS`",`green`,`Module ran; the host was already in the desired state`],["`changed` / `CHANGED`",`yellow`,`Module ran and changed something`],["`failed` / `FAILED`",`red`,`Module reported an error`],["`unreachable` / `UNREACHABLE`",`red`,`Ansible could not connect or log in`],["`skipped`",`cyan`,`A condition was false (playbooks only)`]]}},{h:`command vs shell vs real modules`},{concepts:[{name:`command`,text:"Runs a program directly, with no shell. Pipes, redirects, `&&` and `$VARS` do not work. Safer, and the default module for `ansible`."},{name:`shell`,text:"Runs through `/bin/sh`, so pipes and redirects work. Watch out for injection if you template user input into it."},{name:`Purpose-built modules`,text:"`dnf`, `user`, `service`, `copy`, `file`, `lineinfile`… They know the current state, so they are idempotent and report `changed` accurately. Prefer them."},{name:`raw`,text:`Sends a command over SSH with no Python. Only for bootstrapping hosts that do not have Python yet, or for network devices.`}]},{callout:"`command` and `shell` always report `changed` because Ansible cannot know what your command did. In playbooks you fix that with `creates:`, `removes:`, or `changed_when:` (lesson E4.1).",tone:`note`},{h:`Everyday modules`},{table:{head:[`Module`,`Typical use`],rows:[["`ansible.builtin.ping`",`Check connectivity and Python`],["`ansible.builtin.setup`",`Gather facts (OS, IPs, memory…)`],["`ansible.builtin.dnf` / `apt` / `package`",`Install, upgrade or remove packages`],["`ansible.builtin.service` / `systemd_service`",`Start, stop, enable services`],["`ansible.builtin.copy` / `template`",`Put files on hosts (static or Jinja2)`],["`ansible.builtin.file`",`Directories, permissions, symlinks, delete`],["`ansible.builtin.lineinfile` / `blockinfile`",`Edit one line or a block in an existing file`],["`ansible.builtin.user` / `group`",`Manage accounts`],["`ansible.builtin.uri` / `get_url`",`Call HTTP APIs, download files`]]}},{code:`$ ansible-doc -l | grep -i firewall      # find modules
$ ansible-doc ansible.builtin.user        # full docs with examples
$ ansible-doc -s ansible.builtin.copy     # short snippet of all options`,lang:`bash`}],lab:{title:`Operate the fleet from the command line`,goal:`Use ad-hoc commands to gather information, install a package, manage a user and a file, and see idempotence in action.`,duration:`15 min`,steps:[{title:`Gather information`,text:"All steps run on **controller**, in `~/lab`.",code:{lang:`bash`,code:`$ ansible all -a 'uptime'
$ ansible all -m setup -a 'filter=ansible_memtotal_mb'
$ ansible all -m shell -a 'cat /etc/os-release | head -2'`}},{title:`Install a package twice`,text:`Run the same command twice. The first run reports CHANGED, the second SUCCESS: the module saw the package was already there.`,code:{lang:`bash`,code:`$ ansible web -b -m ansible.builtin.dnf -a 'name=tree state=present'
$ ansible web -b -m ansible.builtin.dnf -a 'name=tree state=present'`}},{title:`Create a user and a file`,code:{lang:`bash`,code:`$ ansible app -b -m ansible.builtin.user -a 'name=deploy shell=/bin/bash'
$ ansible app -b -m ansible.builtin.copy -a 'content="Managed by Ansible\\n" dest=/etc/motd mode=0644'
$ ansible app -a 'cat /etc/motd'`}},{title:`Compare with command`,text:`Run this twice: it always says CHANGED, even though nothing changed the second time.`,code:{lang:`bash`,code:`$ ansible web -b -a 'touch /tmp/marker'`}},{title:`Clean up`,code:{lang:`bash`,code:`$ ansible app -b -m ansible.builtin.user -a 'name=deploy state=absent remove=true'
$ ansible web -b -m ansible.builtin.dnf -a 'name=tree state=absent'`}}],verify:{text:"The second `dnf` and `user` runs report SUCCESS (no change), and `/etc/motd` shows the message on every app node.",code:{lang:`bash`,code:`$ ansible app -b -m ansible.builtin.user -a 'name=deploy shell=/bin/bash'   # before cleanup: SUCCESS, "changed": false`}},challenge:"Using only ad-hoc commands, make `node4` listen on nothing new but have the `chrony` package installed and the `chronyd` service enabled and started. Then run both commands again and confirm they are idempotent."},takeaways:[`Ad-hoc = one module, many hosts. Good for checks and one-offs; repeatable work goes in playbooks.`,"Prefer purpose-built modules over `command`/`shell`: they are idempotent and report changes honestly.","`ansible-doc` is your offline reference; always use fully qualified names like `ansible.builtin.copy`."]}]};export{e as default};