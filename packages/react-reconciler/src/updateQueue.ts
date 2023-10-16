import { Dispatch } from 'react/src/currentDispathcer';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

export interface Update<State> {
	action: Action<State>;
	lane: Lane;
	next: Update<any> | null;
}
export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}
/**
 * Update实例方法
 */
export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		next: null
	};
};

/**
 * UpdateQueue实例方法
 */
export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>;
};

export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending;
	if (pending === null) {
		// pending=a->a
		update.next = update;
	} else {
		update.next = pending.next;
		pending.next = update;
	}
	updateQueue.shared.pending = update;
};

/**
 * 消费 update 方法
 * @param baseState 初始状态
 * @param pendingUpdate 要消费的update
 * @returns 新状态
 */
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): { memoizedState: State } => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};
	if (pendingUpdate !== null) {
		// 第一个update
		const first = pendingUpdate.next;
		let pending = pendingUpdate.next as Update<any>;
		do {
			const updateLane = pending.lane;
			if (updateLane === renderLane) {
				const action = pending.action;
				if (action instanceof Function) {
					// baseState 1 update (x)=> 2x -> memoriedState 1*2=2
					baseState = action(baseState);
				} else {
					// baseState 1 update 2 ->memoriedState 2
					baseState = action;
				}
			} else {
				if (__DEV__) {
					console.error('不应该进入这个逻辑');
				}
			}
			pending = pending.next as Update<any>;
		} while (pending !== first);
	}
	result.memoizedState = baseState;
	return result;
};
