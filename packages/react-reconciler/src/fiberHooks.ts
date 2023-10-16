import internals from 'shared/internals';
import { FiberNode } from './fiber';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Dispatch, Dispatcher } from 'react/src/currentDispathcer';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTag';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: null | Hook = null;

let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;
interface Hook {
	memorizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

export interface Effect {
	tag: Flags;
	create: EffectCallback | null;
	destory: EffectCallback | null;
	deps: EffectDeps;
	next: Effect | null;
}
export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}
type EffectCallback = () => void;
type EffectDeps = any[] | null;
export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// 赋值操作
	currentlyRenderingFiber = wip;
	// 重置操作
	wip.memoizedState = null;
	renderLane = lane;
	const current = wip.alternate;
	if (current !== null) {
		// update
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}
	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);
	// 重置操作
	currentlyRenderingFiber = null;
	renderLane = NoLane;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	// @ts-ignore
	useState: mountState,
	useEffect: mountEffect
};
function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	const hook = mountWorkInProgressHook(); // 取出第一个hook
	const nextDeps = deps === undefined ? null : deps;
	(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect; // 代表mount时候需要处理副作用
	// mount时候
	hook.memorizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	);
}
function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destory: EffectCallback | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destory,
		deps,
		next: null
	};
	const fiber = currentlyRenderingFiber as FiberNode;
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue();
		fiber.updateQueue = updateQueue;
		effect.next = effect; // 指向自己
		updateQueue.lastEffect = effect; // 形成环形列表
	} else {
		// 插入effect
		const lastEffect = updateQueue.lastEffect;
		if (lastEffect === null) {
			effect.next = effect; // 指向自己
			updateQueue.lastEffect = effect;
		} else {
			/**
			 * 环形列表插入操作
			 */
			const firstEffect = lastEffect.next;
			lastEffect.next = effect;
			effect.next = firstEffect;
			updateQueue.lastEffect = effect;
		}
	}
	return effect;
}
function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}
function mountState<State>(
	initialState: () => State | State
): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = mountWorkInProgressHook();
	let memorizedState;
	if (initialState instanceof Function) {
		memorizedState = initialState();
	} else {
		memorizedState = initialState;
	}
	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	hook.memorizedState = memorizedState;
	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
	queue.dispatch = dispatch;
	return [memorizedState, dispatch];
}
function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLane();

	const update = createUpdate(action, lane);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memorizedState: null,
		updateQueue: null,
		next: null
	};
	if (workInProgressHook === null) {
		// mount时 第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内部调用hook');
		} else {
			workInProgressHook = hook;
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// mount时后续的hook
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}
	return workInProgressHook;
}
