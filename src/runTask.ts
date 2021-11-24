import ECS, { TaskOverride, KeyValuePair } from 'aws-sdk/clients/ecs';
import EC2, { Filter } from 'aws-sdk/clients/ec2';
import * as core from '@actions/core';

export class ClusterNotFound extends Error {}
export class TaskCreationError extends Error {}
export class TaskSatateError extends Error {}

interface Params {
  checkClusterExists?: boolean;
  count?: number;
  isPublicIp?: boolean;
  sgFilters?: Filter[];
  sgIds?: string[];
  sgNames?: string[];
  subnetFilters?: Filter[];
  subnetIds?: string[];
  command?: string[];
  environment?: KeyValuePair[];
  timeout?: number;
  wait?: boolean;
  pollDelay?: number;
}

const ecs = new ECS();
const ec2 = new EC2();

async function hasCluster(cluster: string) {
  const foundedClusters = await ecs.describeClusters({ clusters: [cluster] }).promise();

  return foundedClusters.clusters?.[0]?.clusterName === cluster;
}

export default async function runTask(
  taskName: string,
  cluster: string,
  {
    checkClusterExists = false,
    isPublicIp = false,
    count = 1,
    sgFilters,
    sgIds,
    sgNames,
    subnetFilters,
    subnetIds,
    command,
    environment,
    timeout = 600,
    wait = true,
    pollDelay = 6,
  }: Params = {},
) {
  if (checkClusterExists && !(await hasCluster(cluster))) {
    core.error(`Error: cluster "${cluster}" not found! Check out params!`);

    throw new ClusterNotFound();
  }

  const { securityGroupIds, sbnIds } = await core.group('Fetch network settings', async () => {
    const [sg, subnets] = await Promise.all([
      ec2
        .describeSecurityGroups({
          Filters: sgFilters,
          GroupIds: sgIds,
          GroupNames: sgNames,
        })
        .promise(),
      ec2
        .describeSubnets({
          Filters: subnetFilters,
          SubnetIds: subnetIds,
        })
        .promise(),
    ]);

    const securityGroupIds =
      sg.SecurityGroups?.map((group) => group.GroupId).filter((id): id is string => !!id) ??
      undefined;

    core.info(`SecurityGroups ids: ${!securityGroupIds ? 'empty' : securityGroupIds.join(',')}`);

    const sbnIds = (subnets.Subnets?.map((net) => net.SubnetId) ?? []).filter(
      (id): id is string => !!id,
    );

    core.info(`Sunets ids: ${!sbnIds ? 'empty' : sbnIds.join(',')}`);

    return { securityGroupIds, sbnIds };
  });

  return await core.group('Flush task to ECS', async () => {
    core.info(`Run task: ${taskName}`);

    const overrides: TaskOverride = {};

    if (command || environment) {
      overrides.containerOverrides = [
        {
          name: taskName,
          command,
          environment,
        },
      ];
    }

    const task = await ecs
      .runTask({
        count,
        cluster,
        overrides,
        taskDefinition: taskName,
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: sbnIds,
            securityGroups: securityGroupIds,
            assignPublicIp: isPublicIp ? 'ENABLED' : 'DISABLED',
          },
        },
      })
      .promise();

    if (!task.tasks?.length || !task.tasks[0].taskArn) {
      core.error(`Error: task "${taskName}" couldn't created! Check out params!`);

      throw new TaskCreationError();
    }

    if (!wait) {
      console.log('task >>>', task);

      return 0;
    }

    core.info('Wait unill task stopped');

    const tasks = [task.tasks[0].taskArn];

    await ecs
      .waitFor('tasksStopped', {
        cluster,
        tasks,
        $waiter: {
          delay: pollDelay,
          maxAttempts: timeout / pollDelay,
        },
      })
      .promise();

    core.info('Task stopped. Checkout exit state.');

    const taskState = await ecs
      .describeTasks({
        cluster,
        tasks,
      })
      .promise();

    if (!taskState.tasks?.length || !taskState.tasks[0].taskArn) {
      core.error(`Error: task "${taskName}" couldn't fetch current state!`);

      throw new TaskSatateError();
    }

    console.log('task >>>', taskState);

    const exitCode = taskState.tasks[0].containers?.[0].exitCode ?? 1;
    const exitReason = taskState.tasks[0].containers?.[0].reason ?? 'Unknown';

    core.info(`Run finshed. Task stopped with code ${exitCode}`);
    core.info(`Run finshed. Task stopped with reason ${exitReason}`);

    return exitCode;
  });
}
