import { Key, Props, Ref } from 'shared/ReactTypes';
import { WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';

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
	alternate: FiberNode | null;
	flags: Flags;
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
		this.alternate = null;
		this.flags = NoFlags; // 副作用
	}
}
