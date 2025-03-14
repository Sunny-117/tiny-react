const effectStack = [];

function subscribe(effect, subs) {
	subs.add(effect);
	effect.deps.add(subs);
}

function cleanup(effect) {
	for (const subs of effect.deps) {
		subs.delete(effect);
	}
	effect.deps.clear();
}

export function useState(value) {
	const subs = new Set();
	const getter = () => {
		const effect = effectStack[effectStack.length - 1];
		if (effect) {
			subscribe(effect, subs);
		}
		return value;
	};
	const setter = (nextValue) => {
		value = nextValue;
		for (const effect of [...subs]) {
			effect.execute();
		}
	};
	return [getter, setter];
}

export function useEffect(callback) {
	const execute = () => {
		cleanup(effect);
		effectStack.push(effect);
		try {
			callback();
		} finally {
			effectStack.pop();
		}
	};
	const effect = {
		execute,
		deps: new Set()
	};
	execute();
}
export function useMemo(callback) {
	const [s, set] = useState();
	useEffect(() => {
		set(callback());
	}, []);
	return s;
}
