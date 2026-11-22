var e={id:`ka-architecture`,track:`architect`,order:2,title:`Kafka architecture and components`,icon:`Network`,hue:230,blurb:`Brokers, topics, partitions and replicas; KRaft controllers and cluster metadata; producers, consumers and consumer groups; and the ecosystem around the core: Connect, Streams, schemas and replication.`,lessons:[{id:`ka-cluster-anatomy`,title:`Cluster anatomy`,duration:`20 min`,summary:`A Kafka cluster is a set of brokers that store partitions of topics, each partition replicated across several brokers with one leader. This lesson builds the mental model every later decision depends on.`,objectives:[`Explain brokers, topics, partitions, replicas and leaders`,`Describe how partitions spread load and data across a cluster`,`Trace a write and a read through leader and follower replicas`],prereqs:[`ka-log-abstraction`],docs:[{label:`Kafka documentation: main concepts`,url:`https://kafka.apache.org/documentation/#intro_concepts_and_terms`}],blocks:[{h:`The building blocks`},{diagram:`flowchart TB
  subgraph Cluster["Kafka cluster"]
    subgraph B1["Broker 1"]
      P0L["orders-0 leader"]
      P1F["orders-1 follower"]
      P2F1["orders-2 follower"]
    end
    subgraph B2["Broker 2"]
      P1L["orders-1 leader"]
      P0F["orders-0 follower"]
      P2F2["orders-2 follower"]
    end
    subgraph B3["Broker 3"]
      P2L["orders-2 leader"]
      P0F2["orders-0 follower"]
      P1F2["orders-1 follower"]
    end
    CQ["KRaft controller quorum<br/>cluster metadata"]
  end
  CQ -.-> B1
  CQ -.-> B2
  CQ -.-> B3`,title:`Topic "orders": 3 partitions × replication factor 3`},{concepts:[{name:`Broker`,text:`A Kafka server. It stores partition data on local disk, serves reads and writes from clients, and replicates data to and from other brokers.`},{name:`Topic`,text:"A named stream of records, such as `orders` or `payments.authorised`. A logical concept: its data lives in partitions."},{name:`Partition`,text:`An ordered, append-only log and the unit of parallelism. A topic with 12 partitions can be written and read by 12 consumers in parallel. Ordering is guaranteed **within** a partition only.`},{name:`Replica`,text:`A copy of a partition on another broker. The **replication factor** (usually 3) sets how many copies exist.`},{name:`Leader and followers`,text:`One replica per partition is the leader and handles client traffic. Followers fetch from the leader to stay in sync and take over if it fails.`},{name:`In-sync replicas (ISR)`,text:`The set of replicas that are fully caught up with the leader. Only ISR members can become leader without data loss.`}]},{h:`A write and a read`},{diagram:`sequenceDiagram
  participant P as Producer
  participant L as Leader (broker 1)
  participant F as Followers (brokers 2, 3)
  participant C as Consumer
  P->>L: produce record to orders-0
  L->>L: append at offset 418
  F->>L: fetch new records
  L-->>F: records up to 418
  L-->>P: acknowledged once ISR has it (acks=all)
  C->>L: fetch orders-0 from offset 418
  L-->>C: records 418 and later`,title:`Leader-based replication`},{p:`Clients connect to any broker first (a **bootstrap** server), learn from it which broker leads which partition, and then talk directly to the leaders. Because leadership is spread evenly across brokers, load is too. Consumers can also read from a nearby follower when rack awareness is configured, which saves cross-zone traffic.`},{callout:`Partitions are both the unit of scale and the unit of ordering. Almost every Kafka design discussion (throughput, ordering, consumer parallelism, hot spots) comes back to how many partitions a topic has and how records are assigned to them.`,tone:`arch`}],takeaways:[`Brokers store partitions; topics are logical groupings of partitions`,`Each partition has one leader and follower replicas; the ISR are the safe failover candidates`,`Clients talk directly to partition leaders, so load spreads with leadership across brokers`]},{id:`ka-kraft`,title:`KRaft and cluster metadata`,duration:`15 min`,summary:`Kafka manages its own metadata with KRaft, a Raft-based controller quorum. Since Kafka 4.0 ZooKeeper is gone. Learn what controllers do, how metadata flows to brokers, and how to lay controllers out.`,objectives:[`Explain the role of the controller quorum and the metadata log`,`Compare combined and dedicated controller deployments`,`Understand what changed with the removal of ZooKeeper`],prereqs:[`ka-cluster-anatomy`],docs:[{label:`KRaft documentation`,url:`https://kafka.apache.org/documentation/#kraft`}],blocks:[{h:`Metadata is a log too`},{diagram:`flowchart LR
  subgraph Q["Controller quorum (Raft)"]
    C1["Controller 1<br/>active"]
    C2["Controller 2<br/>standby"]
    C3["Controller 3<br/>standby"]
  end
  C1 -->|"replicate metadata log"| C2
  C1 -->|"replicate metadata log"| C3
  C1 -->|"metadata updates"| B1["Broker 1"]
  C1 -->|"metadata updates"| B2["Broker 2"]
  C1 -->|"metadata updates"| B3["Broker 3"]
  B1 -.->|"heartbeats, registration"| C1`,title:`KRaft controller quorum`},{concepts:[{name:`Controller`,text:`Manages cluster metadata: which brokers are alive, topic configuration, partition leaders and ISR, ACLs and quotas. One controller is **active**; the others are hot standbys.`},{name:`Metadata log`,text:"All metadata changes are records in an internal, replicated log (`__cluster_metadata`). Brokers replay it to build their view of the cluster, so failover and startup are fast."},{name:`Raft quorum`,text:`Controllers elect a leader and commit changes when a majority agrees. Three controllers tolerate one failure; five tolerate two.`},{name:`Combined mode`,text:`A node runs both the broker and controller roles. Fine for development and small clusters, but the roles compete for resources.`},{name:`Dedicated controllers`,text:`Separate controller nodes (small machines) and broker nodes. Recommended for production so broker load cannot disturb metadata management.`}]},{h:`Life after ZooKeeper`},{list:[`Kafka 4.0 removed ZooKeeper entirely; clusters still on ZooKeeper must first migrate to KRaft on an eligible 3.x release, following the documented migration procedure, and only then upgrade.`,`One system to deploy, secure and monitor instead of two.`,`Much larger partition counts per cluster, and faster controller failover, because metadata is a log brokers replay instead of state they query.`,`Cluster identity is a **cluster ID** written to every node's storage when it is formatted.`]},{callout:`Plan three (or five) dedicated controllers for production, spread across failure domains such as availability zones. Losing the controller majority stops metadata changes, so new leaders cannot be elected.`,tone:`arch`}],takeaways:[`KRaft controllers manage metadata in a replicated log that brokers replay`,`Use three or five dedicated controllers across failure domains in production`,`Since Kafka 4.0, KRaft is the only mode; ZooKeeper clusters must migrate first`]},{id:`ka-clients-groups`,title:`Producers, consumers and consumer groups`,duration:`20 min`,summary:`Producers choose a partition for every record, and consumers in a group divide partitions between them. These two mechanisms decide ordering, parallelism and how an application scales and recovers.`,objectives:[`Explain how producers pick partitions and batch records`,`Describe how consumer groups share partitions and commit offsets`,`Understand rebalancing and its impact on applications`],prereqs:[`ka-cluster-anatomy`],docs:[{label:`Consumer configuration`,url:`https://kafka.apache.org/documentation/#consumerconfigs`}],blocks:[{h:`Producers`},{concepts:[{name:`Partitioner`,text:`Records with a **key** go to a partition chosen by hashing the key, so all events for one key (one customer, one order) stay in order. Records without a key are spread across partitions in sticky batches.`},{name:`Batching and compression`,text:"Producers group records per partition into batches and compress them (lz4, zstd, snappy, gzip). Bigger batches mean higher throughput at the cost of a few milliseconds of latency (`linger.ms`)."},{name:`Acknowledgements`,text:"`acks=all` (the default) waits until all in-sync replicas have the record. `acks=1` waits for the leader only; `acks=0` does not wait at all."},{name:`Idempotence`,text:"Enabled by default since Kafka 3.0, unless conflicting settings (such as `acks` other than `all`) turn it off: the broker discards duplicates caused by producer retries, so retries do not create duplicate records."}]},{h:`Consumer groups`},{diagram:`flowchart LR
  subgraph T["Topic orders (6 partitions)"]
    P0["P0"]
    P1["P1"]
    P2["P2"]
    P3["P3"]
    P4["P4"]
    P5["P5"]
  end
  subgraph G1["Group billing (3 consumers)"]
    A["Consumer A"]
    B["Consumer B"]
    C["Consumer C"]
  end
  subgraph G2["Group analytics (1 consumer)"]
    D["Consumer D"]
  end
  P0 --> A
  P1 --> A
  P2 --> B
  P3 --> B
  P4 --> C
  P5 --> C
  T ==>|"all 6 partitions"| D`,title:`Two groups read the same topic independently`},{concepts:[{name:`Group`,text:"Consumers with the same `group.id` share the work: each partition is assigned to exactly one member. Different groups each get every record."},{name:`Parallelism limit`,text:`A group can have at most as many active consumers as the topic has partitions. Extra members sit idle, which is why partition count is a capacity decision.`},{name:`Committed offsets`,text:"Consumers commit the offset they have processed to the internal `__consumer_offsets` topic. After a restart or reassignment, the new owner continues from there."},{name:`Rebalance`,text:`When members join, leave or fail, partitions are reassigned. Kafka 4.0 made the new consumer group protocol (KIP-848) generally available: the broker coordinates assignment incrementally, so rebalances no longer pause the whole group.`},{name:`Consumer lag`,text:`The difference between the latest offset in a partition and the group's committed offset. The single most important health metric for consumers.`}]},{callout:`**Share groups** (KIP-932, "queues for Kafka") let several consumers process records from the same partition, with per-record acknowledgement and redelivery. They arrived as early access in Kafka 4.0, became a preview in 4.1 and are production-ready since 4.2 (February 2026); 4.4 adds dead-letter queues for them (KIP-1191). Consumer groups remain the choice when per-partition ordering matters. This course's lab runs Kafka 4.1, where share groups are still a preview.`,tone:`note`},{callout:`Design consumers to be safe when a record is delivered more than once. Rebalances and crashes between processing and committing cause redelivery, and idempotent processing turns that from a bug into a non-event.`,tone:`arch`}],takeaways:[`Keys decide partitions, and partitions decide ordering`,`A consumer group splits partitions among its members; separate groups read independently`,`Watch consumer lag, and make processing idempotent because redelivery happens`]},{id:`ka-ecosystem`,title:`The Kafka ecosystem`,duration:`20 min`,summary:`The core cluster stores and serves streams. Around it sit Kafka Connect for integration, Kafka Streams and Flink for processing, schema registries for data contracts, MirrorMaker 2 for replication, and tools for operations.`,objectives:[`Name the main ecosystem components and their roles`,`Show how they connect to the core cluster in a reference architecture`,`Distinguish what is part of Apache Kafka from what comes from other projects`],prereqs:[`ka-clients-groups`],docs:[{label:`Kafka Connect`,url:`https://kafka.apache.org/documentation/#connect`},{label:`Kafka Streams`,url:`https://kafka.apache.org/documentation/streams/`}],blocks:[{h:`A reference architecture`},{diagram:`flowchart LR
  subgraph Sources["Sources"]
    DB[("Operational databases")]
    APP["Microservices"]
    SAAS["SaaS and files"]
  end
  subgraph Platform["Streaming platform"]
    SC["Source connectors<br/>Kafka Connect, Debezium"]
    K(("Kafka cluster"))
    SR["Schema registry"]
    SP["Stream processing<br/>Kafka Streams, Flink"]
    SK["Sink connectors<br/>Kafka Connect"]
    MM["MirrorMaker 2"]
  end
  subgraph Targets["Targets"]
    DW["Warehouse / lakehouse"]
    SE["Search"]
    CA["Caches and services"]
    DR["DR / other region"]
  end
  DB --> SC --> K
  APP --> K
  SAAS --> SC
  K <--> SP
  K --> SK
  SK --> DW
  SK --> SE
  K --> CA
  K --> MM --> DR
  SR -.->|"schemas"| SC
  SR -.->|"schemas"| SP
  SR -.->|"schemas"| APP`,title:`Kafka at the centre of a data streaming platform`},{concepts:[{name:`Kafka Connect`,text:`Part of Apache Kafka. A scalable framework that runs **connectors**: source connectors pull data into Kafka, sink connectors push it out. Configured through a REST API, no code needed.`},{name:`Debezium`,text:`A set of Connect source connectors for **change data capture**: reads database transaction logs (PostgreSQL, MySQL, Oracle, SQL Server…) and emits every row change as an event.`},{name:`Kafka Streams`,text:`Part of Apache Kafka. A Java library for stateful stream processing (filters, joins, aggregations, windows) that runs inside your application, using Kafka for state backup and scaling.`},{name:`Apache Flink`,text:`A separate distributed stream processing engine with SQL, large state and event-time processing. Common for platform-wide, SQL-driven processing.`},{name:`Schema registry`,text:`Not part of Apache Kafka. Stores Avro, Protobuf or JSON schemas and checks compatibility. Implementations include Confluent Schema Registry, Apicurio Registry and Karapace.`},{name:`MirrorMaker 2`,text:`Part of Apache Kafka, built on Connect. Replicates topics, consumer offsets and configuration between clusters for DR, migration and geo-distribution.`}]},{h:`Operations tooling`},{list:[`**Command-line tools** shipped with Kafka: topics, consumer groups, configs, partition reassignment, log inspection.`,`**Admin API**: everything the tools do, from code, used by operators and automation (Ansible, Terraform, GitOps).`,`**Kubernetes operators** such as Strimzi (CNCF) manage brokers, topics, users and Connect declaratively.`,`**UIs and monitoring**: JMX metrics into Prometheus and Grafana, and web UIs (for example Kafbat UI, AKHQ, Redpanda Console) for browsing topics and groups.`]},{callout:`Treat Connect clusters, stream processors and schema registries as first-class platform components with their own capacity, security and ownership. Most production incidents in streaming platforms happen around the core, not in the brokers.`,tone:`arch`}],takeaways:[`Connect integrates, Streams and Flink process, schema registries define contracts, MirrorMaker 2 replicates`,`Connect, Streams and MirrorMaker 2 are part of Apache Kafka; Debezium, Flink and schema registries are separate projects`,`Plan ecosystem components with the same care as the brokers`]}]};export{e as default};