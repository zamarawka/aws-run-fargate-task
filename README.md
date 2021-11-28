# AWS run Fargate task

This GitHub Action allows run any existing task from ci and wait until it ends. Very useful in case of database migration before new version of app will be deployed.

## Pre Requirements

> All pre requirements should be done before usage.

### Infrastructure

- You need to create task defenition on your AWS console.
- Get AWS's "ci user" keys to pass into "aws-actions/configure-aws-credentials"

### Policies

Minimum sets of policies should be:

- ecs:RunTask
- ecs:DescribeTasks
- ec2:DescribeSubnets
- ec2:DescribeSecurityGroups

In case you need check cluster exists:

- ecs:DescribeClusters

## Usage

```yaml
- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v1
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: us-east-2
- name: Run my ECS task
  uses: zamarawka/aws-run-fargate-task@v1
  with:
    task_name: my-ecs-task
    cluster: my-ecs-cluster
    wait: true
    timeout: 600
```

## Versioning

Package follows [semver](https://semver.org) versioning model.
At now actual package major version is `v1`.
New releases comes with bump version's (`v1.x.x`), but `v1` tag is moving to latest on whole `v1` major release.
So, you could use this github action by this way:

```yaml
- uses: zamarawka/aws-run-fargate-task@v1
```

And stay on actual relese with last fixes and features.
On new major release (in case api breaking change) will be added v2 tag with same update policy.

Not recommended use action by branch name on production, like this:

```yaml
- uses: zamarawka/aws-run-fargate-task@master
```

This is unsafe and could unpredictable break your CI process.

## Inputs

### task_name

Name of existing task definition to execute.

- required: `true`

### cluster

The ECS cluster to execute the task on.

- required: `false`
- default: `default`

### check_cluster_exists

Check cluster exists before task run. Need additional IAM policy.

- required: `false`
- default: `false`

### command

Overide default container command.

- required: `false`

### sg_ids

Security groups ids

- required: `false`

### sg_filters

Security groups filter

- required: `false`

### sg_names

Security groups names

- required: `false`

### subnet_filters

Subnets filter

- required: `false`

### subnet_ids

Subnets ids

- required: `false`

### public_ip

Assign public ip for task

- required: `false`
- default: `false`

### wait

Task ended waiting timeout.

- required: `false`
- default: `true`

### timeout

How long to wait when waiting for the ECS task to timeout.

- required: `false`
- default: `600`

### capacity_provider

Capacity provider type. By default will pick it from your cluster settings.
Useful when you have cluster with mixed tasks.

- required: `false`
- values: `FARGATE` or `FARGATE_SPOT`

### count

Tasks count.

- required: `false`
- default: 1

## Development

1. Create .env file for tests in root folder
1. Run:

```sh
npm install
npm start
```

Other commands

```sh
npm run format # code fomatting
npm run lint # linting
npm run type-check # type-check
npm run build # build release
```

---

Active maintenance with care and ❤️.

Feel free to send a PR.
