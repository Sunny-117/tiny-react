import React from 'react';
import ReactDOM from 'react-dom';
console.log(ReactDOM, 'ReactDOM');
const jsx = (
	<div>
		<span>tiny-react</span>
	</div>
);

function App() {
	return (
		<div>
			<Child />
		</div>
	);
}
function Child() {
	return <span>123</span>;
}
console.log(React);
console.log(jsx);
const root = document.querySelector('#root');
ReactDOM.createRoot(root).render(<App />);
