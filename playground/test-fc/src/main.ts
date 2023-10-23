const button = document.querySelector('button');
const root = document.querySelector('#root');

interface Work {
	count: number; // 类比react中的组件的数量
}
const workList: Work[] = [];
function schedule() {
	const curWork = workList.pop();
	if (curWork) {
		perform(curWork);
	}
}
function perform(work: Work) {
	while (work.count) {
		work.count--;
		insertSpan('0');
	}
	schedule();
}
function insertSpan(content) {
	const span = document.createElement('span');
	span.innerText = content;
	root?.appendChild(span);
}
button &&
	(button.onclick = () => {
		workList.unshift({
			count: 100
		});
		schedule();
	});

// 时间分片原理：将很长的可能掉帧的长的宏任务切成很多短的可能不会造成掉帧的宏任务
