export type Type = any;
export type Key = any;
export type Ref = any;
export type Props = any;
export type ElementType = any;

export interface ReactElementType {
	$$typeof: symbol | number;
	type: ElementType;
	key: Key;
	props: Props;
	ref: Ref;
	__mark: string;
}

/**
 * 两种触发更新的方式
 * this.setState({ name: 'xxx' })
 * this.setState(prevState => ({ name: prevState.name + 'xxx' }))
 */
export type Action<State> = State | ((prevState: State) => State);
