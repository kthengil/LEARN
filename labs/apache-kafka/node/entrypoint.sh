#!/bin/bash
# Start-up for every Kafka lab machine (runs as root, PID 1 is the compose init).
# LAB_ROLE: broker (Kafka broker + KRaft controller), connect (Kafka Connect worker) or client (tools only).
set -euo pipefail
role=${LAB_ROLE:-client}

# Save the service's environment so `kafka-service` can start it again from an SSH session.
export -p | grep -E ' (KAFKA_[A-Z_]*|CLUSTER_ID|LAB_[A-Z_]*)=' > /etc/lab/service.env
chown appuser:appuser /etc/lab/service.env && chmod 600 /etc/lab/service.env

# Login environment for terminals: Kafka tools on PATH and $BOOTSTRAP pointing at the cluster.
cat > /etc/profile.d/kafka-lab.sh <<PROFILE
export JAVA_HOME=/opt/java/openjdk
export PATH=/opt/kafka/bin:/opt/java/openjdk/bin:\$PATH
export BOOTSTRAP=${LAB_BOOTSTRAP:-}
export PS1='\[\e[1;33m\]\u@\h\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ '
PROFILE

case $role in
  broker)  printf 'Kafka broker + KRaft controller (node %s).\nKafka runs as a service here: kafka-service status | stop | start | logs\nData: /var/lib/kafka/data   Tools: kafka-*.sh   Cluster: $BOOTSTRAP\n\n' "${KAFKA_NODE_ID:-?}" ;;
  connect) printf 'Kafka Connect worker. Start it with: kafka-service start   (REST API: curl -s localhost:8083/)\nFiles for the FileStream connectors live in /data.\n\n' ;;
  *)       printf 'Kafka client machine. All Kafka tools are on the PATH and $BOOTSTRAP lists the brokers.\n\n' ;;
esac > /etc/motd

mkdir -p /etc/lab-keys
ssh-keygen -A   # host keys are made per container, never baked into the shared image
/usr/sbin/sshd -E /var/log/sshd.log

if [[ $role != client && ${LAB_AUTOSTART:-true} == true ]]; then
  su-exec appuser /usr/local/bin/kafka-service start || true
fi
exec tail -f /dev/null
