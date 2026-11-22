var e={id:`low-reuse`,track:`low`,order:3,title:`Reuse and structure`,icon:`Boxes`,hue:220,blurb:`Turn playbooks into reusable roles, choose between imports and includes, select work with tags, and package and consume collections.`,lessons:[{id:`l-roles`,title:`Roles`,duration:`40 min`,summary:"A role packages tasks, handlers, templates, files, defaults and metadata into a standard folder layout that any playbook can reuse. Convert the templated web setup into `common` and `nginx` roles.",prereqs:[`l-templates`],objectives:["Know what goes in each role folder, and the difference between `defaults/` and `vars/`","Create roles with `ansible-galaxy role init` and call them from plays","Declare role dependencies in `meta/main.yml` and understand when they run",`Prefix role variables to avoid collisions`],docs:[{label:`Roles`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_reuse_roles.html`}],blocks:[{h:`Role layout`},{code:`roles/nginx/
├── defaults/main.yml    # tunable variables, lowest precedence
├── vars/main.yml        # internal constants, high precedence
├── tasks/main.yml       # entry point; can include other task files
├── handlers/main.yml    # handlers, available to the whole play
├── templates/           # *.j2 files used by the template module
├── files/               # static files used by copy / script
├── meta/main.yml        # dependencies, Galaxy metadata, supported platforms
├── meta/argument_specs.yml   # optional: validate role inputs
└── README.md            # what it does, variables, example`,lang:`text`,title:`Layout`},{p:"Ansible finds files by convention: `template: src=nginx.conf.j2` in a role looks in that role’s `templates/` folder first. That is what makes roles portable."},{diagram:`flowchart LR
  PB["site.yml"] -->|"roles: common"| C["role: common<br/>packages, motd, chrony"]
  PB -->|"roles: nginx"| N["role: nginx"]
  N -->|"meta dependency"| C
  N --> T["tasks/main.yml"]
  N --> D["defaults/main.yml"]
  N --> TP["templates/*.j2"]
  N --> H["handlers/main.yml"]
  INV["inventory group_vars"] -.->|"overrides defaults"| D`,title:`Playbook, roles, and their parts`},{h:`defaults vs vars`},{table:{head:[``,`defaults/main.yml`,`vars/main.yml`],rows:[[`Precedence`,`Lowest of all`,`Higher than inventory and play vars`],[`Purpose`,`The role’s public interface: values users may change`,`Internal constants, OS-specific values`],[`Example`,"`nginx_http_port: 80`","`nginx_package_name: nginx`"]]}},{callout:"Prefix every role variable with the role name (`nginx_http_port`, not `port`). All variables share one namespace per host, so short names collide across roles.",tone:`warn`},{h:`Calling roles`},{code:`- name: Web tier
  hosts: web
  become: true
  roles:                       # classic: runs before the play's tasks
    - common
    - role: nginx
      vars:
        nginx_http_port: 8080

  tasks:
    - name: Dynamic, can be looped or conditional
      ansible.builtin.include_role:
        name: nginx
      when: deploy_web | default(true)

    - name: Static, parsed at load time, tags and when are inherited
      ansible.builtin.import_role:
        name: nginx`,lang:`yaml`},{p:"Order inside a play: `pre_tasks`, then `roles`, then `tasks`, then `post_tasks`. Handlers notified in each section are flushed at the end of it."},{h:`Dependencies and argument specs`},{code:`---
galaxy_info:
  author: you
  description: Install and configure nginx with a templated site
  license: MIT
  min_ansible_version: "2.15"
  platforms:
    - name: EL
      versions: ["9"]
dependencies:
  - role: common`,lang:`yaml`,file:`roles/nginx/meta/main.yml`},{p:`A dependency runs before the role that needs it, and only once per play even if several roles depend on it. It runs again in a **different** play. Dependencies are implicit coupling, so many teams prefer listing roles explicitly in the playbook.`},{code:`---
argument_specs:
  main:
    short_description: Install and configure nginx
    options:
      nginx_http_port:
        type: int
        default: 80
        description: Port the server listens on
      nginx_site_title:
        type: str
        required: false`,lang:`yaml`,file:`roles/nginx/meta/argument_specs.yml`},{callout:"With an argument spec, Ansible validates role inputs before the role runs, and `ansible-doc --type role` can show them. Treat it as the role’s API contract.",tone:`tip`}],lab:{title:`Refactor the web tier into roles`,goal:"Turn `site.yml` from the templates lab into a `common` baseline role and an `nginx` role with defaults, templates, handlers and a dependency.",duration:`25 min`,steps:[{title:`Scaffold the roles`,text:"On **controller**, in `~/lab`.",code:{lang:`bash`,code:`$ mkdir -p roles && cd roles
$ ansible-galaxy role init common
$ ansible-galaxy role init nginx
$ cd .. && rm -rf roles/*/tests roles/*/vars roles/*/files`}},{title:`Write the common role`,code:[{lang:`yaml`,file:`roles/common/defaults/main.yml`,code:`---
common_packages: [vim-minimal, tar, chrony]
common_motd: "{{ inventory_hostname }}: managed by Ansible, do not edit by hand"`},{lang:`yaml`,file:`roles/common/tasks/main.yml`,code:`---
- name: Install base packages
  ansible.builtin.dnf:
    name: "{{ common_packages }}"
    state: present
  tags: [common, packages]

- name: Set the message of the day
  ansible.builtin.copy:
    content: "{{ common_motd }}\\n"
    dest: /etc/motd
    mode: "0644"
  tags: [common]

- name: Ensure chronyd is running
  ansible.builtin.service:
    name: chronyd
    state: started
    enabled: true
  tags: [common]`}]},{title:`Write the nginx role`,text:"Move both templates into `roles/nginx/templates/` and rename variables with the `nginx_` prefix: `http_port` → `nginx_http_port`, `web_root` → `nginx_web_root`, `redirects` → `nginx_redirects`, `site_title` → `nginx_site_title`. Create `roles/nginx/meta/main.yml` and `roles/nginx/meta/argument_specs.yml` from the lesson above.",code:[{lang:`yaml`,file:`roles/nginx/defaults/main.yml`,code:`---
# Tunables: override these from inventory or the play.
nginx_http_port: 80
nginx_web_root: /srv/www
nginx_workers: auto
nginx_site_title: Ansible course shop
nginx_redirects: {}`},{lang:`yaml`,file:`roles/nginx/tasks/main.yml`,code:`---
- name: Install nginx
  ansible.builtin.dnf:
    name: nginx
    state: present
  tags: [nginx, packages]

- name: Create the web root
  ansible.builtin.file:
    path: "{{ nginx_web_root }}"
    state: directory
    mode: "0755"
  tags: [nginx, config]

- name: Deploy nginx.conf
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    mode: "0644"
    validate: nginx -t -c %s
  notify: Reload nginx
  tags: [nginx, config]

- name: Deploy the home page
  ansible.builtin.template:
    src: index.html.j2
    dest: "{{ nginx_web_root }}/index.html"
    mode: "0644"
  tags: [nginx, content]

- name: Ensure nginx is running and enabled
  ansible.builtin.service:
    name: nginx
    state: started
    enabled: true
  tags: [nginx]`},{lang:`yaml`,file:`roles/nginx/handlers/main.yml`,code:`---
- name: Reload nginx
  ansible.builtin.service:
    name: nginx
    state: reloaded`}]},{title:`Write a short playbook that uses them`,code:{lang:`yaml`,file:`roles.yml`,code:`---
- name: Baseline for every server
  hosts: app
  become: true
  roles:
    - common

- name: Web tier
  hosts: web
  become: true
  roles:
    - role: nginx
      vars:
        nginx_site_title: Built from a role
        nginx_redirects:
          /old: /`}},{title:`Run it`,code:{lang:`bash`,code:`$ ansible-playbook roles.yml
$ ansible-playbook roles.yml     # changed=0`}}],verify:{text:"The home page title is now BUILT FROM A ROLE, `/etc/motd` is set on all four nodes, and the task names in the output are prefixed with the role: `nginx : Deploy nginx.conf`.",code:{lang:`bash`,code:`$ curl -s http://node2/ | grep h1
<h1>BUILT FROM A ROLE</h1>
$ ansible app -a 'cat /etc/motd'`}},solution:{text:"Notice that `common` runs twice on node2 and node3: once in the baseline play and again as a dependency of `nginx` in the web play. Dependencies are de-duplicated within a play, not across plays. Either remove the dependency or drop the baseline play for web hosts. Explicit plays are usually clearer."},challenge:"Add `meta/argument_specs.yml` to the nginx role, then run with `-e nginx_http_port=abc` and read the validation error."},takeaways:[`A role is a convention-based folder: tasks, handlers, templates, files, defaults, vars, meta.`,"`defaults/` is the public interface; prefix every variable with the role name.",`Argument specs make role inputs explicit and validated.`]},{id:`l-includes-tags`,title:`Imports, includes and tags`,duration:`25 min`,summary:"Split work into files and decide whether to load them statically (`import_*`) or dynamically (`include_*`). Use tags to run only part of a playbook.",prereqs:[`l-roles`],objectives:["Explain static vs dynamic reuse and their effect on `when`, `loop`, tags and handlers","Choose `import_tasks`, `include_tasks`, `import_playbook`, `import_role` or `include_role` for a given need","Tag tasks and roles, and run or skip them with `--tags` and `--skip-tags`","Use the special tags `always` and `never`"],docs:[{label:`Re-using Ansible artifacts`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_reuse.html`},{label:`Tags`,url:`https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_tags.html`}],blocks:[{h:`Static vs dynamic`},{diagram:`flowchart TB
  subgraph S["import_* (static)"]
    direction LR
    S1["Parsed when the playbook loads"] --> S2["Tasks copied in place"] --> S3["when and tags applied to every task inside"]
  end
  subgraph D["include_* (dynamic)"]
    direction LR
    D1["Evaluated when execution reaches it"] --> D2["File name can use variables, can loop"] --> D3["when applies to the include itself"]
  end`,title:`Two ways to reuse`},{table:{head:[`Behaviour`,`import_tasks / import_role`,`include_tasks / include_role`],rows:[[`Processed`,`At parse time`,`At run time`],["`loop`",`Not allowed`,`Allowed`],[`Variables in file name`,`Only vars known at parse time`,`Any variable, including facts`],["`when`",`Copied onto every inner task`,`Evaluated once, on the include`],["`--tags` on inner tasks",`Work`,"Need `apply: {tags: …}` or tagging the include"],["`--list-tasks` shows inner tasks",`Yes`,`No`],[`Notify handlers defined inside`,`Yes`,`Only after the include has run`]]}},{callout:`Rule of thumb: **import** by default, because it is predictable and tag-friendly. **Include** when you need a loop, a file chosen by a variable (for example per OS), or to skip a whole file cheaply.`,tone:`tip`},{code:`- name: OS-specific variables, picked at run time
  ansible.builtin.include_vars: "{{ ansible_facts['os_family'] }}.yml"

- name: Same install steps for each site, in a loop
  ansible.builtin.include_tasks: site.yml
  loop: "{{ sites }}"
  loop_control:
    loop_var: site            # avoid clashing with item inside site.yml

- name: Static, so --tags hardening reaches every task inside
  ansible.builtin.import_tasks: hardening.yml
  tags: [hardening]`,lang:`yaml`},{code:`---
- ansible.builtin.import_playbook: baseline.yml
- ansible.builtin.import_playbook: web.yml
- ansible.builtin.import_playbook: db.yml`,lang:`yaml`,file:`site.yml (a playbook of playbooks)`},{h:`Tags`},{code:`$ ansible-playbook site.yml --list-tags
$ ansible-playbook site.yml --tags config            # only tasks tagged config
$ ansible-playbook site.yml --tags 'nginx,common'
$ ansible-playbook site.yml --skip-tags packages
$ ansible-playbook site.yml --tags never,debug       # run tasks tagged never only when asked`,lang:`bash`},{list:["Tags on a play, role or `import_*` are inherited by every task inside.","`always`: runs unless explicitly skipped with `--skip-tags always`. Good for setting facts other tasks need.","`never`: skipped unless one of its other tags is requested. Good for dangerous or debug tasks."]},{callout:`Tags are a sharp tool. Running a subset can skip tasks that set facts or variables later tasks rely on. Agree on a small, documented tag vocabulary (packages, config, content, service) instead of tagging ad hoc.`,tone:`warn`}],lab:{title:`Split, loop and tag`,goal:`Create several sites per web server with a looped include, and compare how tags and when behave with import and include.`,duration:`15 min`,steps:[{title:`A task file for one site`,code:{lang:`yaml`,file:`tasks/site.yml`,code:`---
- name: Create web root for {{ site.name }}
  ansible.builtin.file:
    path: "/srv/sites/{{ site.name }}"
    state: directory
    mode: "0755"

- name: Write the index page for {{ site.name }}
  ansible.builtin.copy:
    content: "{{ site.title }} on {{ inventory_hostname }}\\n"
    dest: "/srv/sites/{{ site.name }}/index.html"
    mode: "0644"`}},{title:`A playbook that loops over it and uses tags`,code:{lang:`yaml`,file:`sites.yml`,code:`---
- name: Several sites per server
  hosts: web
  become: true
  vars:
    sites:
      - { name: shop, title: The shop }
      - { name: blog, title: The blog }
      - { name: docs, title: The docs }

  tasks:
    - name: Facts every other task needs
      ansible.builtin.set_fact:
        build_time: "{{ now(utc=true).isoformat() }}"
      tags: [always]

    - name: Create each site
      ansible.builtin.include_tasks:
        file: tasks/site.yml
        apply:
          tags: [content]
      loop: "{{ sites }}"
      loop_control:
        loop_var: site
      tags: [content]

    - name: Show the build time
      ansible.builtin.debug:
        msg: "Built at {{ build_time }}"
      tags: [report]

    - name: Dangerous cleanup, only when asked
      ansible.builtin.file:
        path: /srv/sites
        state: absent
      tags: [never, cleanup]`}},{title:`Try different tag selections`,code:{lang:`bash`,code:`$ ansible-playbook sites.yml --list-tasks
$ ansible-playbook sites.yml
$ ansible-playbook sites.yml --tags report       # set_fact still runs: tagged always
$ ansible-playbook sites.yml --tags cleanup      # the never task runs only now`}}],verify:{text:"After a normal run there are three folders under `/srv/sites` on each web node. `--tags report` prints the build time without touching the sites. `--tags cleanup` deletes the folder, so run the playbook normally once more before listing it.",code:{lang:`bash`,code:`$ ansible-playbook sites.yml | tail -3
$ ansible web -a 'ls /srv/sites'`}},challenge:"Change `include_tasks` to `import_tasks`. The run fails, because `loop` is not allowed on an import. Explain why from the static vs dynamic table."},takeaways:[`Import = static, predictable, tag-friendly. Include = dynamic, loopable, variable file names.`,"Use `loop_var` when looping over includes to avoid `item` collisions.","Keep a small tag vocabulary; use `always` for prerequisites and `never` for dangerous tasks."]},{id:`l-collections`,title:`Collections and Galaxy`,duration:`30 min`,summary:`Collections are the distribution format for modules, plugins and roles. Install them from Galaxy or Automation Hub with a pinned requirements file, use them by fully qualified name, and package your own.`,prereqs:[`l-roles`],objectives:[`Explain what a collection contains and how FQCNs resolve`,"Install collections and roles from `requirements.yml` into a project folder",`Create, build and install your own collection`,`Choose a versioning and source strategy (Galaxy, Automation Hub, private hub, Git)`],docs:[{label:`Using collections`,url:`https://docs.ansible.com/ansible/latest/collections_guide/index.html`},{label:`Developing collections`,url:`https://docs.ansible.com/ansible/latest/dev_guide/developing_collections.html`}],blocks:[{h:`What is in a collection`},{code:`ansible_collections/lab/platform/
├── galaxy.yml            # namespace, name, version, dependencies
├── meta/runtime.yml      # supported ansible-core versions, redirects
├── plugins/
│   ├── modules/          # custom modules
│   ├── filter/           # Jinja2 filters
│   ├── lookup/           # lookups
│   └── inventory/        # inventory plugins
├── roles/
│   ├── common/
│   └── nginx/
├── playbooks/            # playbooks callable as lab.platform.site
└── docs/ README.md`,lang:`text`,title:`Collection layout`},{p:"Everything inside is addressed by its **fully qualified collection name**: `namespace.collection.item`. For example `community.general.ini_file` (a module), `ansible.utils.ipaddr` (a filter) and `lab.platform.nginx` (a role)."},{diagram:`flowchart LR
  REQ["requirements.yml<br/>pinned versions"] --> G["ansible-galaxy collection install"]
  G --> GAL[("Galaxy<br/>galaxy.ansible.com")]
  G --> HUB[("Automation Hub /<br/>private hub")]
  G --> GIT[("Git repo or<br/>local tarball")]
  G --> P["./collections/ansible_collections/..."]
  P --> PB["Playbook uses FQCN<br/>community.general.ini_file"]`,title:`Where collections come from`},{h:`requirements.yml`},{code:`---
collections:
  - name: ansible.posix
    version: ">=1.5.0,<3.0.0"
  - name: community.general
    version: ">=8.0.0"
  - name: https://github.com/example/ansible-collection-internal.git
    type: git
    version: v2.3.1
  - name: ./src/lab-platform-1.0.0.tar.gz
    type: file

roles:
  - name: geerlingguy.redis
    version: 1.9.0`,lang:`yaml`,file:`requirements.yml`},{code:`$ ansible-galaxy collection install -r requirements.yml -p ./collections
$ ansible-galaxy role install -r requirements.yml -p ./roles
$ ansible-galaxy collection list
$ ansible-doc community.general.ini_file`,lang:`bash`},{callout:"Pin versions and install into the project (`collections_path = ./collections`), not into your home folder. Otherwise two projects on the same machine silently share and upgrade each other’s collections. In CI, build an execution environment instead (lesson E5.4).",tone:`arch`},{h:`Build your own`},{code:`$ ansible-galaxy collection init lab.platform --init-path src
$ cp -r roles/nginx roles/common src/lab/platform/roles/
$ ansible-galaxy collection build src/lab/platform --output-path src
Created collection for lab.platform at src/lab-platform-1.0.0.tar.gz
$ ansible-galaxy collection publish src/lab-platform-1.0.0.tar.gz --api-key ...   # to Galaxy or a private hub`,lang:`bash`},{p:"Inside a collection, roles refer to each other by FQCN: a dependency on `common` becomes `lab.platform.common`. Follow semantic versioning: bump the major version when you rename variables or remove options."}],lab:{title:`Package your roles as a collection and use community modules`,goal:"Build `lab.platform` from your roles, install it with two community collections from one requirements file, and use all three in a playbook.",duration:`20 min`,steps:[{title:`Create and build the collection`,text:"Set `version: 1.0.0` in `galaxy.yml`, and change the dependency in `roles/nginx/meta/main.yml` inside the collection to `lab.platform.common`.",code:{lang:`bash`,code:`$ ansible-galaxy collection init lab.platform --init-path src
$ cp -r roles/nginx roles/common src/lab/platform/roles/
$ sed -i 's/role: common/role: lab.platform.common/' src/lab/platform/roles/nginx/meta/main.yml
$ ansible-galaxy collection build src/lab/platform --output-path src`}},{title:`Write requirements.yml and install`,code:[{lang:`yaml`,file:`requirements.yml`,code:`---
collections:
  - name: ansible.posix
    version: ">=1.5.0"
  - name: community.general
    version: ">=8.0.0"
  - name: ./src/lab-platform-1.0.0.tar.gz
    type: file`},{lang:`bash`,code:`$ ansible-galaxy collection install -r requirements.yml
$ ansible-galaxy collection list | grep -E 'lab.platform|ansible.posix|community.general'`}]},{title:`Use everything by FQCN`,code:{lang:`yaml`,file:`collection.yml`,code:`---
- name: Use roles and modules from collections
  hosts: web
  become: true
  tasks:
    - name: Apply the web role from our own collection
      ansible.builtin.import_role:
        name: lab.platform.nginx
      vars:
        nginx_site_title: From a collection

    - name: Tune a setting with a community.general module
      community.general.ini_file:
        path: /etc/lab-app.ini
        section: server
        option: workers
        value: "4"
        mode: "0644"

    - name: Authorise the deploy key with ansible.posix
      ansible.posix.authorized_key:
        user: ansible
        key: "{{ lookup('ansible.builtin.file', '~/.ssh/id_ed25519.pub') }}"`}},{title:`Run it`,code:{lang:`bash`,code:`$ ansible-playbook collection.yml`}}],verify:{text:"Task names show `lab.platform.nginx : …`, the page title reads FROM A COLLECTION, and `/etc/lab-app.ini` contains a `[server]` section.",code:{lang:`bash`,code:`$ curl -s http://node3/ | grep h1
$ ansible web -a 'cat /etc/lab-app.ini'`}},challenge:"Bump the collection to 1.1.0 with a new default `nginx_site_title`, rebuild, and install with `--force`. Then pin `requirements.yml` to `==1.0.0` and reinstall to roll back."},takeaways:[`Collections distribute modules, plugins and roles; always call content by FQCN.`,"Pin versions in `requirements.yml` and install per project.",`Package internal roles as a versioned collection once more than one team consumes them.`]}]};export{e as default};