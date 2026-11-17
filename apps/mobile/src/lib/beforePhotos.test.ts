import { describe, expect, it } from 'vitest';
import { parseBeforePhotos } from './beforePhotos';

const p = (id: string, folder: string, slot = 'frente') => ({ id, url: `http://s3/${id}`, folder, slot });

describe('parseBeforePhotos', () => {
  it('fica com as fotos do checklist de entrada novo e da vistoria inicial antiga', () => {
    const data = [p('a', 'vistoria_inicial'), p('b', 'checklist_entrada'), p('c', 'vistoria_final'), p('d', 'acompanhamento')];
    expect(parseBeforePhotos(data).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('aceita resposta paginada e descarta item malformado', () => {
    const data = { results: [p('a', 'checklist_entrada'), { id: 'x' }, null] };
    expect(parseBeforePhotos(data)).toEqual([{ id: 'a', url: 'http://s3/a', slot: 'frente' }]);
  });

  it('resposta inesperada vira lista vazia', () => {
    expect(parseBeforePhotos('<html>')).toEqual([]);
  });
});
