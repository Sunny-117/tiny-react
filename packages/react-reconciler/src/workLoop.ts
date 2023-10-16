import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane; // 本次更新的lane
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	workInProgress = createWorkInProgress(root.current, {});
	wipRootRenderLane = lane;
}
function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}
/**
 * 在fiber中调度update
 */
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// 调度功能
	// fiberRootNode
	const root = markUpdateFromFiberToRoot(fiber); // 当前触发更新的fiber一直遍历到fiberRootNode
	markRootUpdated(root, lane);
	// renderRoot(root);
	ensureRootIsScheduled(root);
}

// schedule 调度阶段入口
function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	if (updateLane === NoLane) {
		// 没有update更新
		return;
	}
	if (updateLane === SyncLane) {
		// 同步优先级：微任务调度
		if (__DEV__) {
			console.log('在微任务中调度优先级:', updateLane);
		}
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 其他优先级：宏任务调度
	}
}

function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}
	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}

function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
	const nextLane = getHighestPriorityLane(root.pendingLanes);
	if (nextLane !== SyncLane) {
		// 1. 其他比SyncLane低的优先级
		// 2. NoLane
		ensureRootIsScheduled(root);
		return;
	}
	if (__DEV__) {
		console.warn('render阶段开始');
	}
	// 初始化
	prepareFreshStack(root, lane);
	do {
		try {
			workLoop();
			break;
		} catch (error) {
			if (__DEV__) {
				console.warn('workLoop发生错误', error);
			}
			workInProgress = null;
		}
	} while (true);
	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;
	root.finishedLane = lane;
	wipRootRenderLane = NoLane;
	// 根据wip fiberNode树 和 树种的flags执行具体的操作
	commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
	// 三个子阶段
	// beforeMutation
	// mutation(突变)
	// layout
	const finishedWork = root.finishedWork;
	if (finishedWork === null) {
		return;
	}
	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}
	const lane = root.finishedLane;
	if (lane === NoLane && __DEV__) {
		console.error('commit阶段finishedLane不应该为Nolane');
	}
	// 重置操作
	root.finishedWork = null;
	root.finishedLane = NoLane;
	markRootFinished(root, lane);
	// 判断是否存在三个子阶段需要执行的操作
	// 判断root本身的flags和root subtreeFlags
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;
	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation Placement
		commitMutationEffects(finishedWork);
		root.current = finishedWork;
		// layout
	} else {
		root.current = finishedWork;
	}
}
function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}
function performUnitOfWork(fiber: FiberNode) {
	// next可能是子fiber，也可能是null
	const next = beginWork(fiber, wipRootRenderLane); // 向下递阶段
	fiber.memoizedProps = fiber.pendingProps;
	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	// 如果有子节点，就遍历子节点
	// 如果没有，就遍历兄弟节点
	let node: FiberNode | null = fiber;
	do {
		completeWork(node); // 向上归阶段
		const sibling = node.sibling;
		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}
		node = node.return;
		workInProgress = null;
	} while (node !== null);
}
