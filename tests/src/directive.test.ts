import transform from '@diplodoc/transform';

import {directive} from '../../src';

const html = (text: string) => {
    const {result} = transform(text, {
        plugins: [directive],
    });

    return result.html;
};

describe('Directive', () => {
    it('should do something', () => {
        expect(html('a')).toBe('<p>a</p>\n');
    })
});
