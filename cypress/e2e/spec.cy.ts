describe('template spec', () => {
  it('passes', () => {
    cy.visit('http://localhost:3000/login')
    cy.get('[name="email"]').click();
    cy.get('[name="email"]').type('bikenwebocto@gmail.com');
    cy.get('[name="password"]').type('biken@123');
    cy.get('#auth-sign-in button.c-bOcPnF').click();
  })
})