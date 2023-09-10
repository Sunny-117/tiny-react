import React from 'react';
import ReactDOM from 'react-dom';
console.log(ReactDOM, 'ReactDOM');
const jsx = (
	<div>
		<span>tiny-react</span>
	</div>
);

console.log(React);
console.log(jsx);
const root = document.querySelector('#root');
ReactDOM.createRoot(root).render(jsx);
