// 1. useEffect执行后，回调函数立即执行
// 2. 依赖的自变量变化后，回调函数立即执行
// 3. 不需要显示指明依赖

const effectStack = [];
function subscribe(effect, subs) {
	subs.add(effect);
	effect.deps.add(subs);
}

function cleanup() {
	for (const subs of effect.deps) {
		subs.delete(effect);
	}
	effect.deps.clear();
}
