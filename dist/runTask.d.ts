import { KeyValuePair } from 'aws-sdk/clients/ecs';
import { Filter } from 'aws-sdk/clients/ec2';
export declare class ClusterNotFound extends Error {
}
export declare class TaskCreationError extends Error {
}
export declare class TaskSatateError extends Error {
}
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
export default function runTask(taskName: string, cluster: string, { checkClusterExists, isPublicIp, count, sgFilters, sgIds, sgNames, subnetFilters, subnetIds, command, environment, timeout, wait, pollDelay, }?: Params): Promise<number>;
export {};
