const { Array } = global;
const val = [1, 2];
console.log(Array.isArray(val) && typeof val[0] === 'number');
