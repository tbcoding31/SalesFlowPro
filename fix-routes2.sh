sed -i '439,$d' src/App.tsx
cat << 'INNER_EOF' >> src/App.tsx
          />
          <Route
            path="/customer-report"
            element={
              <ProtectedRoute>
                <CustomerReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
INNER_EOF
