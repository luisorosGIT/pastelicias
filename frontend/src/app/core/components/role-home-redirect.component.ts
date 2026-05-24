import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { homePathForRole } from '../utils/home-path';

/**
 * Mini-componente "wormhole": al renderizarse, redirige al usuario a la
 * página principal de su rol. Se usa para la ruta raíz `''` y para el
 * fallback `**`, evitando loops cuando el rol no tiene acceso a /dashboard.
 */
@Component({
  selector: 'app-role-home-redirect',
  standalone: true,
  template: '',
})
export class RoleHomeRedirectComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    const target = homePathForRole(this.auth.role());
    void this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
