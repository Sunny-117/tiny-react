import {
	Container,
	appendInitialChild,
	createInstance,
	createTextInstance,
	removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { NoFlags, Update } from './fiberFlags';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';

function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update;
}
// 递归中的归阶段
// 构建离屏的dom树
export const completeWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps;
	const current = wip.alternate;
	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// 对于HostComponent，wip.stateNode保存的是dom节点
				// update
				// e.g: className a->b 标记Update
				// 1. props是否变化了 {onClick: xxx} -> {onClick: yyy}
				// 2. 变化了 Update flag
				updateFiberProps(wip.stateNode, newProps);
				// FiberNode.updateQueue = [className, 'aaa', title, 'hahaha']; [n, n+1]
				// updateQueue中保存什么东西变了，以及变成了什么
			} else {
				// mount 首屏渲染流程;
				// 1. 构建dom树
				// const instance = createInstance(wip.type, newProps);
				const instance = createInstance(wip.type, newProps);
				// 2. 将dom插入到dom树中
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps?.content;
				const newText = newProps.content;
				if (oldText !== newText) {
					markUpdate(wip);
				}
			} else {
				// 首屏渲染流程;
				// 1. 构建dom树
				const instance = createTextInstance(newProps.content); // 创建文本节点
				// 2. 将dom插入到dom树中
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostRoot:
		case FunctionComponent:
		case Fragment:
			bubbleProperties(wip);
			return null;

		default:
			if (__DEV__) {
				console.warn('未处理的completeWork情况', wip);
			}
			break;
	}
};

/**
 * case1:
 * function A() {
 * 	return <div></div>
 * }
 * <h3><A /></h3>
 *
 * case2: 需要递归
 * <h3>
 * 	<A />
 *  <A />
 * </h3>
 */
function appendAllChildren(parent: Container, wip: FiberNode) {
	let node = wip.child;
	while (node !== null) {
		if (node?.tag === HostComponent || node?.tag === HostText) {
			appendInitialChild(parent, node.stateNode);
		} else if (node.child !== null) {
			// 往下找
			node.child.return = node;
			node = node.child;
			continue;
		}
		if (node === wip) {
			return;
		}
		// 往下遍历了，没找到；兄弟节点也没找到
		// 需要往上归了
		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				// 回到了原点
				return;
			}
			node = node?.return;
		}
		node.sibling.return = node.return;
		node = node?.sibling;
	}
}

function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = wip.child;
	while (child !== null) {
		// subtreeFlags包含了当前节点的子节点的flags以及子节点的subtreeFlags
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;
		child.return = wip;
		child = child.sibling; // 遍历sibling
	}
	wip.subtreeFlags |= subtreeFlags;
}

function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root;
	while (true) {
		onCommitUnmount(node);

		if (node.child !== null) {
			// 向下遍历
			node.child.return = node;
			node = node.child;
			continue;
		}
		if (node === root) {
			// 终止条件
			return;
		}
		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}
			// 向上归
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return;

	while (parent) {
		const parentTag = parent.tag;
		// HostComponent HostRoot
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}
		parent = parent.return;
	}
	if (__DEV__) {
		console.warn('未找到host parent');
	}
	return null;
}
function commitDeletion(childToDelete: FiberNode) {
	const rootChildrenToDelete: FiberNode[] = [];
	// 递归子树
	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				return;
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				return;
			case FunctionComponent:
				// todo
				return;
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber);
				}
		}
	});
	// 移除rootHostComponent的DOM
	if (rootChildrenToDelete.length) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, hostParent);
			});
		}
	}
	childToDelete.return = null;
	childToDelete.child = null;
}

function recordHostChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	// 1. 找到第一个root host节点
	let lastOne = childrenToDelete[childrenToDelete.length - 1];
	if (!lastOne) {
		childrenToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber);
			}
			node = node.sibling;
		}
	}
	// 2. 每找到一个host节点，判断下这个节点是不是第一步找到那个节点的兄弟节点
}
