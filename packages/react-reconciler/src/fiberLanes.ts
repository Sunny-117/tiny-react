import { FiberRootNode } from './fiber';

export type Lane = number;

export type Lanes = number;

export const SyncLane = 0b00001; // 同步优先级
export const NoLane = 0b00000;
export const NoLanes = 0b00000;
export const InputContinuousLane = 0b00010;
export const DefaultLane = 0b00100;
export const TransitionLane = 0b01000;
export const IdleLane = 0b10000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
	return laneA | laneB;
}
export function requestUpdateLane() {
	return SyncLane;
}

// 越小，优先级越高 。0 除外
export function getHighestPriorityLane(lanes: Lanes): Lane {
	return lanes & -lanes;
}
export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}
