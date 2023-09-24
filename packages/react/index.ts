import { Dispatcher, resolveDispatcher } from './src/currentDispathcer';
import { jsxDEV } from './src/jsx';
import currentDispatcher from './src/currentDispathcer';

export const useState: Dispatcher['useState'] = (initialState: any) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
};
// 内部数据共享层
export const _SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher
};
export default {
	version: '0.0.0',
	createElement: jsxDEV
};
