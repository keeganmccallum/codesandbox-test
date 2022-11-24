import React from "react";

import "./styles.css";

import { Switch, Route, Link, BrowserRouter as Router } from "react-router-dom";

import { CollaborativeEditor } from "./CollaborativeEditor";

export const App: React.FC = () => {
  return (
    <Router>
      <Switch>
        <Route path="/document/:documentId" exact>
          <CollaborativeEditor></CollaborativeEditor>
        </Route>

        <Route path="/" exact>
          <div>
            Try <Link to="document/testcollab123">Document 123</Link>
          </div>
        </Route>
      </Switch>
    </Router>
  );
};
