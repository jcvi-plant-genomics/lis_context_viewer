import { Algorithm } from '../models/algorithm.model';
import { SET_ORDER } from '../reducers/actions';

export const orderFilter = (state: Algorithm = null, {type, payload}) => {
  switch (type) {
    case SET_ORDER:
      return payload;
    default:
      return state;
  }
};