// 合成事件
import { Props } from 'shared/ReactTypes';

export const elementPropsKey = '__props';
export interface DOMElement extends Element {
	[elementPropsKey]: Props;
}
export function updateFiberProps(node: DOMElement, props: Props) {
	node[elementPropsKey] = props;
}
