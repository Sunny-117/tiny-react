import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode, createFiberFromElement } from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { Placement } from './fiberFlags';

/**
 *
 * @param shouldTrack 是否追踪副作用
 * @returns
 */
function ChildReconciler(shouldTrackEffects: boolean) {
	function reconcilerSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		// 根据element创建一个fiber
		const fiber = createFiberFromElement(element);
		fiber.return = returnFiber;
		return fiber;
	}
	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	/**
	 * 根据 shouldTrackEffects 来判断是否应该标记副作用的flags
	 * @param fiber
	 */
	function placeSingleChild(fiber: FiberNode) {
		// 传进来的fiber是新创建的fiber，即WIP fiber，fiber.alternate即current fiber，fiber.alternate为null，说明是一个首屏渲染情况
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags != Placement;
		}
		return fiber;
	}
	return function reconcilerChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcilerSingleElement(returnFiber, currentFiber, newChild)
					);
				default:
					if (__DEV__) {
						console.warn('未实现的reconciler类型', newChild);
					}
					break;
			}
		}
		// todo: 多节点的情况 ul > li*3
		// 文本节点
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}
		if (__DEV__) {
			console.warn('未实现的reconciler类型', newChild);
		}
		return null;
	};
}
// 追踪副作用
export const reconcilerChildFibers = ChildReconciler(true);
// 不追踪副作用
export const mountChildFibers = ChildReconciler(false);
