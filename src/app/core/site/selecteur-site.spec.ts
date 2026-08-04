import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

/**
 * Reproduit la forme exacte du sélecteur de site de la barre du haut : une
 * portée connue **avant** que la liste des sites n'arrive, ce qui est le cas au
 * rechargement de page puisqu'elle est restaurée depuis `localStorage` tandis
 * que les sites viennent d'un appel HTTP.
 *
 * Le piège : `[value]` sur le `<select>` est posé par Angular avant que le
 * `@for` n'ait créé les `<option>`. Le navigateur ignore une valeur qui ne
 * correspond à aucune option et retombe sur la première — l'écran affichait
 * alors un site différent de celui réellement appliqué aux données.
 */

/** La forme corrigée : la sélection est portée par les options. */
@Component({
  standalone: true,
  template: `
    @if (sites().length > 0) {
      <select>
        @for (s of sites(); track s.id) {
          <option [value]="s.id" [selected]="choisi() === s.id">{{ s.nom }}</option>
        }
      </select>
    }
  `,
})
class SelecteurCorrige {
  readonly sites = signal<{ id: number; nom: string }[]>([]);
  readonly choisi = signal<number | null>(null);
}

/** La forme d'origine, conservée pour documenter le défaut qu'on corrige. */
@Component({
  standalone: true,
  template: `
    @if (sites().length > 0) {
      <select [value]="choisi() ?? ''">
        @for (s of sites(); track s.id) {
          <option [value]="s.id">{{ s.nom }}</option>
        }
      </select>
    }
  `,
})
class SelecteurParValue {
  readonly sites = signal<{ id: number; nom: string }[]>([]);
  readonly choisi = signal<number | null>(null);
}

const SITES = [
  { id: 2, nom: 'Site cocody' },
  { id: 1, nom: 'Site principal' },
];

describe('sélecteur de site — portée restaurée avant la liste', () => {
  it('affiche le site restauré, et non le premier de la liste', () => {
    const fixture = TestBed.createComponent(SelecteurCorrige);

    // Portée connue d'emblée (localStorage), liste encore vide.
    fixture.componentInstance.choisi.set(1);
    fixture.detectChanges();

    // La liste arrive : « Site cocody » est premier, « Site principal » est choisi.
    fixture.componentInstance.sites.set(SITES);
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    expect(select.value).toBe('1');
    expect(select.selectedOptions[0].textContent?.trim()).toBe('Site principal');
  });

  it('suit un changement de portée ultérieur', () => {
    const fixture = TestBed.createComponent(SelecteurCorrige);
    fixture.componentInstance.sites.set(SITES);
    fixture.componentInstance.choisi.set(1);
    fixture.detectChanges();

    fixture.componentInstance.choisi.set(2);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('select').value).toBe('2');
  });

  it('montre pourquoi [value] sur le <select> ne suffisait pas', () => {
    const fixture = TestBed.createComponent(SelecteurParValue);
    fixture.componentInstance.choisi.set(1);
    fixture.detectChanges();
    fixture.componentInstance.sites.set(SITES);
    fixture.detectChanges();

    // Le sélecteur retombe sur la première option alors que la portée vaut 1 :
    // c'est exactement la divergence constatée à l'usage.
    expect(fixture.nativeElement.querySelector('select').value).toBe('2');
  });
});
