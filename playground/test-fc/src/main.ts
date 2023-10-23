import {
	unstable_ImmediatePriority as ImmediatePriority, // 同步更新
	unstable_UserBlockingPriority as UserBlockingPriority, // 比如点击事件
	unstable_NormalPriority as NormalPriority, // 正常的优先级
	unstable_LowPriority as LowPriority, // 低优先级
	unstable_IdlePriority as IdlePriority, // 空闲时候的优先级
	unstable_scheduleCallback as scheduleCallback,
	unstable_shouldYield as shouldYield, // 当前的时间切片有没有用完
	CallbackNode,
	unstable_getFirstCallbackNode as getFirstCallbackNode, // 当前正在调度的回调
	unstable_cancelCallback as cancelCallback
} from 'scheduler';
import './style.css';
const root = document.querySelector('#root');

type Priority =
	| typeof IdlePriority
	| typeof LowPriority
	| typeof NormalPriority
	| typeof UserBlockingPriority
	| typeof ImmediatePriority;
[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach(
	(priority) => {
		const button = document.createElement('button');
		root?.appendChild(button);
		button.innerText = [
			'',
			'ImmediatePriority',
			'UserBlockingPriority',
			'NormalPriority',
			'LowPriority'
		][priority];
		button.onclick = () => {
			workList.unshift({
				count: 100,
				priority: priority as Priority
			});
			schedule();
		};
	}
);
interface Work {
	count: number; // 类比react中的组件的数量
	priority: Priority;
}
const workList: Work[] = [];
let prevPriority = IdlePriority;
let curCallback: CallbackNode | null = null;
function schedule() {
	const cbNode = getFirstCallbackNode();
	// 找到优先级最高的work
	const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0];
	// 策略逻辑
	if (!curWork) {
		curCallback = null;
		cbNode && cancelCallback(cbNode);
		return;
	}
	const { priority: curPriority } = curWork;
	if (curPriority === prevPriority) {
		return;
	}
	// 更高优先级的wok
	cbNode && cancelCallback(cbNode);
	// 用调度器在宏任务中调度;
	curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));
}
function perform(work: Work, didTimeout?: boolean) {
	/**
	 * 1. work.priority
	 * 2. 饥饿问题
	 * 3. 时间切片
	 */
	const needSync = work.priority === ImmediatePriority || didTimeout;
	while ((needSync || !shouldYield()) && work.count) {
		work.count--;
		insertSpan(work.priority + '');
	}
	// 中断执行 || 执行完了
	prevPriority = work.priority;
	if (!work.count) {
		const workIndex = workList.indexOf(work);
		workList.splice(workIndex, 1);
		// 重置
		prevPriority = IdlePriority;
	}
	const prevCallback = curCallback;
	schedule();
	const newCallback = curCallback;
	if (newCallback && prevCallback === newCallback) {
		return perform.bind(null, work);
	}
}
function insertSpan(content) {
	const span = document.createElement('span');
	span.innerText = content;
	span.className = `pri-${content}`;
	doSumBuzyWork(10000000);
	root?.appendChild(span);
}
// 时间分片原理：将很长的可能掉帧的长的宏任务切成很多短的可能不会造成掉帧的宏任务

function doSumBuzyWork(len: number) {
	let result = 0;
	while (len--) {
		result += len;
	}
}
