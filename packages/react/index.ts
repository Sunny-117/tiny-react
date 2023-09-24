import { Dispatcher, resolveDispatcher } from './src/currentDispathcer';
import { jsxDEV, jsx, isValidElement as isValidElementFn } from './src/jsx';
import currentDispatcher from './src/currentDispathcer';

export const useState: Dispatcher['useState'] = (initialState: any) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
};
// 内部数据共享层
export const _SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher
};
export const version = '0.0.0';
// TODO: 根据环境区分使用jsx或者jsxDev
export const createElement = jsx;
export const isValidElement = isValidElementFn;
