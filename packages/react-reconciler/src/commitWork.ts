import { Container, appendChildToContainer, commitUpdate } from 'hostConfig';
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
	if (hostParent !== null) {
		appendPlacementNodeIntoContainer(finishedWork, hostParent);
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

function appendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container
) {
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		appendChildToContainer(hostParent, finishedWork.stateNode);
		return;
	}
	const child = finishedWork.child;
	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;
		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}
