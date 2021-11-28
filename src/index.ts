import { getInput, setFailed, getMultilineInput, getBooleanInput, info } from '@actions/core';

import runTask, { CapacityProvider } from './runTask';

function numberify(v: string) {
  const val = parseInt(v);

  return isNaN(val) ? undefined : val;
}

function parseArray(v: string, delimeter = ',') {
  return v ? v.split(delimeter) : undefined;
}

function parseObject(v: string, { name = 'Name', value = 'Values' } = {}) {
  const re = new RegExp(`${name}=(?<n>.+),${value}=(?<val>.+)`);
  const match = re.exec(v);

  if (!match?.groups) {
    return undefined;
  }

  const { n, val } = match.groups;

  return {
    [name]: n,
    [value]: val,
  };
}

function parseEnum<T extends string>(v: string, values: string[]) {
  return values.includes(v) ? (v as T) : undefined;
}

function parseObjects(v: string[], params?: Parameters<typeof parseObject>[1]) {
  return v.map((val) => parseObject(val, params)).filter((v): v is { [k: string]: string } => !!v);
}

function parseFilters(...args: Parameters<typeof parseObjects>) {
  const obj = parseObjects(...args);

  return obj.map(({ Values, ...obj }) => ({ ...obj, Values: [Values] }));
}

export default async function main() {
  const task_name = getInput('task_name', { required: true, trimWhitespace: true });
  const cluster = getInput('cluster', { trimWhitespace: true }) ?? 'default';
  const command = parseArray(getInput('command', { trimWhitespace: true }), ' ');

  const environment = parseObjects(getMultilineInput('environment', { trimWhitespace: true }), {
    name: 'name',
    value: 'value',
  });

  // const secrets = getInput('secrets');
  // const cpu = getInput('cpu');
  // const memory = getInput('memory');
  // const exec_role = getInput('exec_role');
  // const task_role = getInput('task_role');

  const wait = getBooleanInput('wait') ?? true;
  const checkClusterExists = getBooleanInput('check_cluster_exists') ?? false;
  const isPublicIp = getBooleanInput('public_ip') ?? false;
  const timeout = numberify(getInput('timeout')) ?? 600;
  const count = numberify(getInput('count')) ?? 1;
  const sgIds = parseArray(getInput('sg_ids', { trimWhitespace: true }));
  const sgFilters = parseFilters(getMultilineInput('sg_filters', { trimWhitespace: true }));
  const sgNames = parseArray(getInput('sg_names', { trimWhitespace: true }));
  const subnetFilters = parseFilters(getMultilineInput('subnet_filters', { trimWhitespace: true }));
  const subnetIds = parseArray(getInput('subnet_ids', { trimWhitespace: true }));
  const capacityProvider = parseEnum<CapacityProvider>(
    getInput('capacity_provider', { trimWhitespace: true }),
    ['FARGATE', 'FARGATE_SPOT'],
  );

  info('Run fargate task');

  try {
    const res = await runTask(task_name, cluster, {
      checkClusterExists,
      isPublicIp,
      count,
      command,
      environment,
      wait,
      timeout,
      sgIds,
      sgFilters,
      sgNames,
      subnetFilters,
      subnetIds,
      capacityProvider,
    });

    if (res) {
      return setFailed('Task finished with error code');
    }

    info('Task run finished!');
  } catch (err: any) {
    console.error(err);

    return setFailed(`Task setup failed!`);
  }
}

main();
