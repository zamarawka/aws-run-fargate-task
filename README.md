# AWS run Fargate task

This GitHub Action allows run any existing task from ci and wait until it ends. Very useful in case of database migration before new version of app will be deployed.

This action expects AWS credentials to have already been initialized.

## Usage

### Executing an existing task
```yaml
  - name: Configure AWS Credentials
    uses: aws-actions/configure-aws-credentials@v1
    with:
      aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
      aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      aws-region: us-east-2
  - name: Run my ECS task
    uses: zamarawka/aws-run-fargate-task@master
    with:
      task_name: my-ecs-task
      cluster: my-ecs-cluster
      wait: true
      timeout: 600
```


## Inputs

### task_name ###
Name of existing task definition to execute.
- required: true

### cluster ###
The ECS cluster to execute the task on.
- required: false
- default: default

### command ###
Overide default container command.
- required: false

### sg_ids ###
Security groups ids
- required: false

### sg_filter ###
Security groups filter
-required: false

### sg_names ###
Security groups names
-required: false

### subnet_filters ###
Subnets filter
-required: false

### subnet_ids ###
Subnets ids
-required: false

### wait ###
Task ended waiting timeout.
- required: false
- default: true

### timeout ###
How long to wait when waiting for the ECS task to timeout.
- required: false
- default: 600


Active maintenance with care and ❤️.

Feel free to send a PR.
