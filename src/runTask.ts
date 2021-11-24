import ECS, { KeyValuePair, RunTaskRequest } from 'aws-sdk/clients/ecs';
import EC2, { Filter } from 'aws-sdk/clients/ec2';
import * as core from '@actions/core';

export class ClusterNotFound extends Error {}
export class TaskCreationError extends Error {}
export class TaskSatateError extends Error {}

export type CapacityProvider = 'FARGATE' | 'FARGATE_SPOT';

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
  capacityProvider?: CapacityProvider;
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
    capacityProvider,
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

    const runTaksRequestParams: RunTaskRequest = {
      count,
      cluster,
      taskDefinition: taskName,
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: sbnIds,
          securityGroups: securityGroupIds,
          assignPublicIp: isPublicIp ? 'ENABLED' : 'DISABLED',
        },
      },
    };

    if (command || environment) {
      runTaksRequestParams.overrides = {
        containerOverrides: [
          {
            name: taskName,
            command,
            environment,
          },
        ],
      };
    }

    if (capacityProvider) {
      runTaksRequestParams.capacityProviderStrategy = [
        {
          base: count,
          capacityProvider,
          weight: 1,
        },
      ];
    }

    const runTaskResponse = await ecs.runTask(runTaksRequestParams).promise();

    if (!runTaskResponse.tasks?.length || !runTaskResponse.tasks[0].taskArn) {
      console.log('Run ecs task response >>>', runTaskResponse);

      core.error(`Error: task "${taskName}" couldn't created! Check out params!`);

      throw new TaskCreationError();
    }

    if (!wait) {
      console.log('task >>>', runTaskResponse);

      return 0;
    }

    core.info('Wait unill task stopped');

    const tasks = [runTaskResponse.tasks[0].taskArn];

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

    core.info(`Run finished. Task stopped with code "${exitCode}" and reason "${exitReason}"`);
    return exitCode;
  });
}
