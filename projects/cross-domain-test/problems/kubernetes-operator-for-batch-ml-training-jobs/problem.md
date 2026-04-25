---
slug: kubernetes-operator-for-batch-ml-training-jobs
title: Kubernetes operator for batch ML training jobs
status: active
project: cross-domain-test
created_at: 2026-04-25
---

## description
We need a Kubernetes operator that schedules and manages batch ML training jobs across heterogeneous GPU node pools. Operator must implement custom resource definitions for jobs, automatic node-affinity selection based on GPU type, pod-disruption budgets, checkpoint persistence to S3, and cost-aware scheduling that prefers spot instances. We are looking for prior-art operator patterns, controller frameworks, GPU-scheduler implementations, and KubeBuilder-based ML platforms.

## success_criteria
- Custom Resource Definition for a TrainingJob type
- Node-affinity selection by GPU memory + architecture
- Checkpoint persistence with restart-from-checkpoint
- Cost-aware spot-instance preference with graceful preemption handling
- Operator follows KubeBuilder/Operator-SDK conventions

## constraints
- Go-based operator, KubeBuilder framework
- Open-source license (Apache-2.0 preferred)
- Must work with multi-cloud (AWS, GCP, Azure)

## non_goals
- Replacing Kubeflow's full pipeline architecture
- Building a model-registry on top
- Inference-serving (separate concern)

## current_approach
- Manual ad-hoc Job objects with init-containers
- Spot-instance handling via raw nodeSelector annotations
- Checkpoint logic implemented in user training scripts

## hints
- search_terms: kubernetes operator, kubebuilder, batch job scheduling, gpu scheduler, ml training operator, custom resource definition, controller runtime, spot instance handling, pod disruption budget
- tech_tags: kubernetes, k8s, golang, kubebuilder, operator-sdk, controller-runtime, helm, gpu, cuda
- constraint_tags: opensource, apache-or-mit, multi-cloud
- approach_keywords: custom-resource-definition, controller-pattern, node-affinity, gpu-scheduling, spot-preemption, checkpoint-persistence

## suspected_approach_axes
- scheduler_strategy: gang-scheduling ↔ priority-class ↔ topology-aware
- checkpoint_layer: pvc-based ↔ object-store ↔ in-memory
- cost_model: spot-only ↔ mixed-pool ↔ preemption-tolerant
