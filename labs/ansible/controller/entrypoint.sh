#!/bin/bash
# Controller start-up: the Ansible SSH key (kept in the home volume), shared with the nodes, then sshd.
set -euo pipefail
install -d -m 700 -o ansible -g ansible /home/ansible/.ssh
if [[ ! -f /home/ansible/.ssh/id_ed25519 ]]; then
  su ansible -c "ssh-keygen -q -t ed25519 -N '' -C ansible-controller -f /home/ansible/.ssh/id_ed25519"
fi
mkdir -p /etc/ansible-keys
install -m 644 /home/ansible/.ssh/id_ed25519.pub /etc/ansible-keys/authorized_keys
ssh-keygen -A   # host keys are made per container, never baked into the shared image
exec /usr/sbin/sshd -D -e
