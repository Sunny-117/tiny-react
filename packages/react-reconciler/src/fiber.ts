import { Key, Props, Ref } from 'shared/ReactTypes';
import { WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';

export class FiberNode {
	type: any;
	tag: WorkTag;
	pendingProps: Props;
	key: Key;
	ref: Ref;
	stateNode: any;
	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;
	memoizedProps: Props | null;
	memoizedState: any;
	alternate: FiberNode | null;
	flags: Flags;
	updateQueue: unknown;
	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		/**
		 * 实例
		 */
		this.tag = tag;
		this.key = key;
		this.stateNode = null; // dom节点
		this.type = null; // 类型
		/**
		 * 构成树状结构
		 */
		this.return = null; // 父节点
		this.sibling = null; // 兄弟节点
		this.child = null; // 子节点
		this.index = 0; // 当前节点在父节点中的位置
		this.ref = null; // ref
		/**
		 * 作为工作单元
		 */
		this.pendingProps = pendingProps;
		this.memoizedProps = null; // 工作完成后的props是什么
		this.memoizedState = null;
		this.alternate = null;
		this.flags = NoFlags; // 副作用
		this.updateQueue = null;
	}
}

export class FiberRootNode {
	container: Container;
	current: FiberNode;
	finishedWork: FiberNode | null;
	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
	}
}

export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	// 双缓存机制
	let wip = current.alternate;
	if (wip === null) {
		// 首次渲染 mount
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.type = current.type;
		wip.stateNode = current.stateNode;
		wip.alternate = current;
		current.alternate = wip;
	} else {
		// update
		wip.pendingProps = pendingProps;
		wip.flags = NoFlags;
		wip.updateQueue = current.updateQueue;
		wip.child = current.child;
		wip.memoizedProps = current.memoizedProps;
		wip.memoizedState = current.memoizedState;
	}
	return wip;
};
