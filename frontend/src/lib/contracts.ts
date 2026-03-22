import TaskEscrowABI from '../../abi/TaskEscrow.json'
import WorkerRegistryABI from '../../abi/WorkerRegistry.json'

export const TASK_ESCROW = {
  address: (process.env.NEXT_PUBLIC_TASK_ESCROW_ADDRESS || '0x0') as `0x${string}`,
  abi: TaskEscrowABI,
} as const

export const WORKER_REGISTRY = {
  address: (process.env.NEXT_PUBLIC_WORKER_REGISTRY_ADDRESS || '0x0') as `0x${string}`,
  abi: WorkerRegistryABI,
} as const
