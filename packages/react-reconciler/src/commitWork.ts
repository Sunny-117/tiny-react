import {
	Container,
	Instance,
	appendChildToContainer,
	commitUpdate,
	insertChildToContainer
} from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import { MutationMask, NoFlags, Placement, Update } from './fiberFlags';
import { HostComponent, HostRoot, HostText } from './workTags';

let nextEffects: FiberNode | null = null;
export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffects = finishedWork;
	while (nextEffects !== null) {
		const child: FiberNode | null = nextEffects.child;
		if (
			(nextEffects.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			nextEffects = child;
		} else {
			// 向上遍历
			up: while (nextEffects !== null) {
				commitMutationEffectsOnFiber(nextEffects);
				const sibling: FiberNode | null = nextEffects.sibling;
				if (sibling !== null) {
					nextEffects = sibling;
					break up;
				}
			}
		}
	}
};

function commitMutationEffectsOnFiber(finishedWork: FiberNode) {
	const flags = finishedWork.flags;
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement;
	}
	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Update;
	}
}

function commitPlacement(finishedWork: FiberNode) {
	if (__DEV__) {
		console.warn('执行placement操作');
	}
	const hostParent = getHostParent(finishedWork);
	const sibling = getHostParent(finishedWork);
	// host sibling
	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
	}
}
function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber;
	findSibling: while (true) {
		while (node.sibling === null) {
			// 同级没有sibling了
			const parent = node.return;
			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				// 终止条件 没找到
				return null;
			}
			// 向上遍历
			node = parent;
		}
		node.sibling.return = node.return;
		node = node.sibling;
		while (node.tag !== HostText && node.tag !== HostComponent) {
			// 向下遍历，找子孙节点
			if ((node.flags & Placement) !== NoFlags) {
				// 该节点不稳定
				continue findSibling;
			}
			if (node.child === null) {
				// 到底了，没有child了
				continue findSibling;
			} else {
				// 向下遍历;
				node.child.return = node;
				node = node.child;
			}
		}
		if ((node.flags & Placement) === NoFlags) {
			// 找到了目标的Host类型的节点
			return node.stateNode;
		}
	}
}
function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return;
	while (parent !== null) {
		const parentTag = parent.tag;
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}
		parent = parent.return;
	}
	if (__DEV__) {
		console.warn('未找到 host parent');
	}
	return null;
}

function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance
) {
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}
		appendChildToContainer(hostParent, finishedWork.stateNode);
		return;
	}
	const child = finishedWork.child;
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;
		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}
