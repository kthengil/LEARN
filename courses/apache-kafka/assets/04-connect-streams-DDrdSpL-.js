var e={id:`ke-connect-streams`,track:`engineer`,order:4,title:`Integration and stream processing`,icon:`Workflow`,hue:45,blurb:`Run a Kafka Connect worker and move data in and out of Kafka with connectors managed over REST, then run a stateful Kafka Streams application and look at the topics it creates.`,lessons:[{id:`ke-connect`,title:`Kafka Connect`,duration:`25 min`,summary:`Kafka Connect runs connectors that copy data between Kafka and other systems, configured entirely through a REST API. Start a worker, create a source and a sink connector, and manage them while data flows.`,objectives:[`Start a distributed Connect worker and explore its REST API`,`Create, inspect, pause and delete source and sink connectors`,`Find where Connect stores its configuration, offsets and status`],prereqs:[`ke-consumer-groups`],docs:[{label:`Kafka Connect user guide`,url:`https://kafka.apache.org/documentation/#connect_user`},{label:`Connect REST API`,url:`https://kafka.apache.org/documentation/#connect_rest`}],blocks:[{h:`Connect architecture`},{diagram:`flowchart LR
  F1[("/data/input.txt")] --> SRC["file-source<br/>source connector task"]
  SRC --> T(("topic file-lines"))
  T --> SNK["file-sink<br/>sink connector task"]
  SNK --> F2[("/data/output.txt")]
  subgraph W["Connect worker (machine connect)"]
    SRC
    SNK
    REST["REST API :8083"]
  end
  U["curl in the connect terminal"] --> REST
  W -.->|"configs, offsets, status"| IT(("_connect-configs<br/>_connect-offsets<br/>_connect-status"))`,title:`The lab pipeline`},{concepts:[{name:`Worker`,text:"A JVM process that runs connectors and their tasks. In distributed mode, workers with the same `group.id` form a cluster and share the work."},{name:`Connector and tasks`,text:`A connector is a configured integration (for example "read this table"). It splits the job into tasks, which do the actual copying in parallel.`},{name:`Converters`,text:`Turn Kafka bytes into Connect's internal data and back: String, JSON, Avro, Protobuf. The lab uses plain strings.`},{name:`Internal topics`,text:`Distributed workers keep connector configs, source offsets and status in compacted Kafka topics, so they survive restarts and can move between workers.`},{name:`Plugins`,text:"Connectors are installed as plugins on the `plugin.path`. The FileStream connectors used here ship with Kafka and are meant for demos; real pipelines use connectors such as Debezium, JDBC, S3 or Elasticsearch."}]},{callout:"Use `PUT /connectors/<name>/config` rather than `POST /connectors`: PUT creates the connector if it does not exist and updates it if it does, so the same call works in scripts and pipelines every time.",tone:`tip`}],lab:{kind:`hands-on`,title:`Stream a file through Kafka`,duration:`20 min`,goal:"Start Connect, copy lines from `/data/input.txt` into a topic with a source connector, and write them to `/data/output.txt` with a sink connector.",steps:[{title:`Start the Connect worker`,text:`Open a terminal on **connect**. The worker is installed but not running yet; start it and query its REST API. Every step of this lab runs on connect except where noted.`,code:{title:`On connect`,code:`$ kafka-service start
Starting Kafka Connect worker...
Kafka Connect worker started (pid 40), listening on port 8083
$ curl -s localhost:8083/
{"version":"4.1.0","commit":"13f70256db3c994c","kafka_cluster_id":"4L6g3nShT-eMCtK--X86sw"}
$ curl -s localhost:8083/connector-plugins`,lang:`bash`}},{title:`Create the input file and the source connector`,code:{title:`On connect`,code:`$ printf 'first line\\nsecond line\\n' > /data/input.txt
$ curl -s -X PUT -H 'Content-Type: application/json' localhost:8083/connectors/file-source/config -d '{
    "connector.class": "org.apache.kafka.connect.file.FileStreamSourceConnector",
    "tasks.max": "1",
    "file": "/data/input.txt",
    "topic": "file-lines"
  }'`,lang:`bash`}},{title:`Create the sink connector`,code:{title:`On connect`,code:`$ curl -s -X PUT -H 'Content-Type: application/json' localhost:8083/connectors/file-sink/config -d '{
    "connector.class": "org.apache.kafka.connect.file.FileStreamSinkConnector",
    "tasks.max": "1",
    "file": "/data/output.txt",
    "topics": "file-lines"
  }'`,lang:`bash`}},{title:`Watch data flow`,text:"Append a line and check the output a few seconds later. Quote the status URL: the `?` is a shell wildcard character.",code:{title:`On connect`,code:`$ echo "third line" >> /data/input.txt
$ cat /data/output.txt
first line
second line
third line
$ curl -s 'localhost:8083/connectors?expand=status'
$ curl -s localhost:8083/connectors/file-sink/status`,lang:`bash`}},{title:`Look at the topics`,text:`The data topic plus Connect's own internal topics.`,code:{title:`On consumer`,code:`$ kafka-console-consumer.sh --bootstrap-server $BOOTSTRAP --topic file-lines --from-beginning --max-messages 3
$ kafka-topics.sh --bootstrap-server $BOOTSTRAP --list | grep connect
_connect-configs
_connect-offsets
_connect-status`,lang:`bash`}},{title:`Pause, resume and delete`,code:{title:`On connect`,code:`$ curl -s -X PUT localhost:8083/connectors/file-sink/pause
$ echo "fourth line" >> /data/input.txt         # reaches the topic, not output.txt
$ curl -s -X PUT localhost:8083/connectors/file-sink/resume
$ curl -s -X DELETE localhost:8083/connectors/file-source`,lang:`bash`}}],verify:{text:"Both connectors report `RUNNING`; `/data/output.txt` contains every line of `/data/input.txt`; while the sink is paused new lines reach the topic but not the output file, and they appear when it resumes."},solution:{text:"If a connector shows `FAILED`, `curl -s localhost:8083/connectors/<name>/status` includes the stack trace, and `kafka-service logs` on connect shows the worker log. A common cause is a mistyped file path, or a file the worker's user (`appuser`) cannot read."},challenge:"Restart the worker (`kafka-service restart` on connect) and append another line. Does the source connector re-read the whole file or continue where it stopped? Find the answer in the `_connect-offsets` topic."},takeaways:[`Connect workers run connectors and tasks, configured through the REST API`,`Distributed workers store configs, offsets and status in compacted Kafka topics`,`PUT on /connectors/<name>/config is the idempotent way to create or update connectors`]},{id:`ke-streams`,title:`Kafka Streams in action`,duration:`25 min`,summary:`Run Kafka's WordCount example, a stateful Kafka Streams application, against the lab cluster. See how it reads, aggregates with a local state store, and writes a continuously updated result, and which internal topics make it fault-tolerant.`,objectives:[`Run a Kafka Streams application against the cluster`,`Explain the repartition and changelog topics it creates`,`Read an updating aggregate from an output topic`],prereqs:[`ke-retention-compaction`],docs:[{label:`Kafka Streams: run the demo application`,url:`https://kafka.apache.org/documentation/streams/quickstart`}],blocks:[{h:`The WordCount topology`},{diagram:`flowchart LR
  IN(("streams-plaintext-input")) --> SPLIT["flatMapValues<br/>split lines into words"]
  SPLIT --> KEY["groupBy word<br/>re-key records"]
  KEY --> RP(("…-repartition<br/>internal topic"))
  RP --> CNT["count()<br/>RocksDB state store"]
  CNT --> CL(("…-changelog<br/>internal, compacted"))
  CNT --> OUT(("streams-wordcount-output<br/>word → count"))`,title:`WordCount: stateless split, re-key, stateful count`},{concepts:[{name:`Repartition topic`,text:`Grouping by a new key (the word) means records for one word must reach the same task. Streams writes them to an internal topic keyed by the word, then reads them back.`},{name:`State store`,text:`The running counts live in a local RocksDB database inside the application, so lookups are fast and need no external database.`},{name:`Changelog topic`,text:`Every change to the state store is also written to a compacted topic. If the application or its machine is lost, a new instance rebuilds the store from the changelog.`},{name:`Application ID`,text:"Names the consumer group, the internal topics and the state directory (`streams-wordcount` here). Run more instances with the same ID and they share the partitions."}]},{callout:"The lab's node image adds `libstdc++` to the official Kafka image. RocksDB is a native library, and the official image is based on Alpine Linux without it, so stateful Streams applications fail there with an `UnsatisfiedLinkError`. Remember this when you build your own Streams container images.",tone:`warn`}],lab:{kind:`hands-on`,title:`Count words continuously`,duration:`20 min`,goal:`Run WordCount, feed it lines of text, and watch the counts update in the output topic.`,steps:[{title:`Create the topics`,text:`The output is a table (word → count), so it is compacted.`,code:{title:`On producer`,code:`$ kafka-topics.sh --bootstrap-server $BOOTSTRAP --create --topic streams-plaintext-input --partitions 3 --replication-factor 3
$ kafka-topics.sh --bootstrap-server $BOOTSTRAP --create --topic streams-wordcount-output --partitions 3 \\
    --replication-factor 3 --config cleanup.policy=compact`,lang:`bash`}},{title:`Start the application`,text:`WordCount reads its Kafka settings from a properties file given as its argument. Run it in a terminal on **consumer** and leave it running.`,code:{title:`On consumer`,code:`$ echo "bootstrap.servers=$BOOTSTRAP" > /tmp/wordcount.properties
$ kafka-run-class.sh org.apache.kafka.streams.examples.wordcount.WordCountDemo /tmp/wordcount.properties`,lang:`bash`}},{title:`Read the output`,text:`Shift-click **consumer** to open a second terminal. Counts are 8-byte longs, so tell the console consumer how to decode them.`,code:{title:`On consumer (second terminal)`,code:`$ kafka-console-consumer.sh --bootstrap-server $BOOTSTRAP --topic streams-wordcount-output --from-beginning \\
    --property print.key=true --property key.separator=" = " \\
    --value-deserializer org.apache.kafka.common.serialization.LongDeserializer`,lang:`bash`}},{title:`Write some text`,code:{title:`On producer`,code:`$ kafka-console-producer.sh --bootstrap-server $BOOTSTRAP --topic streams-plaintext-input
> kafka streams are fun
> kafka is a log
> streams of events`,lang:`bash`}},{title:`Watch the counts update`,text:`The second consumer terminal shows a new record each time a word's count changes.`,code:{title:`On consumer (second terminal)`,code:`kafka = 1
streams = 1
are = 1
fun = 1
kafka = 2
is = 1
a = 1
log = 1
streams = 2
of = 1
events = 1`,lang:`text`}},{title:`Find the internal topics`,code:{title:`On producer`,code:`$ kafka-topics.sh --bootstrap-server $BOOTSTRAP --list | grep wordcount
streams-wordcount-KSTREAM-AGGREGATE-STATE-STORE-0000000003-changelog
streams-wordcount-KSTREAM-AGGREGATE-STATE-STORE-0000000003-repartition
streams-wordcount-output`,lang:`bash`}}],verify:{text:`Every line you type produces updated counts for its words within a second or two, and the changelog and repartition topics exist.`},solution:{text:"If no counts appear, check the WordCount terminal for errors. An `UnsatisfiedLinkError` mentioning `libstdc++` means RocksDB could not load its native library: the lab image installs it, but a plain `apache/kafka` image does not have it."},challenge:"Stop WordCount (Ctrl+C), type more lines, then start it again. Are the earlier counts remembered? Then run `kafka-streams-application-reset.sh --bootstrap-server $BOOTSTRAP --application-id streams-wordcount --input-topics streams-plaintext-input` with the app stopped, and start it once more. What changed?"},takeaways:[`Kafka Streams applications are plain Java programs that read, process and write Kafka topics`,`Re-keying creates a repartition topic; state stores are backed by compacted changelog topics`,`Native libraries (RocksDB needs libstdc++) must be present in your Streams container images`]}]};export{e as default};